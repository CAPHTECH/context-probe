import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type {
  CochangeCommit,
  DomainDesignShadowRolloutGateEvaluation,
  DomainModel
} from "../src/core/contracts.js";
import { compareEvolutionLocalityModels } from "../src/core/history.js";
import { loadDomainModel } from "../src/core/model.js";
import {
  evaluateShadowRolloutGate,
  loadShadowRolloutRegistry,
  registryToGateObservations
} from "../src/core/shadow-rollout.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";

const TIE_TOLERANCE = 0.02;
const DRIFT_TOLERANCE = 0.05;
const MAX_THIN_HISTORY_CONFIDENCE = 0.75;
const MAX_THIN_HISTORY_LOCALITY_SCORE = 0.5;
const MIN_REPO_BACKED_ADVANTAGE_CASES = 2;
const MIN_IMPROVEMENT_RATE = 0.2;
const REAL_REPO_REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");
const SIM_PRISM_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/sim_prism-domain-model.yaml"
);
const PCE_MEMORY_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/pce-memory-domain-model.yaml"
);
const ZAKKI_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/zakki-domain-model.yaml"
);
const ASSAY_KIT_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/assay-kit-domain-model.yaml"
);
const PROJECT_LOGICA_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/project_logica-domain-model.yaml"
);

const SYNTHETIC_MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] }
  ]
};

interface LocalityComparisonResult {
  els: {
    score: number;
    components: { CCL: number; FS: number; SCR: number };
  };
  persistenceCandidate: {
    localityScore: number;
    persistentCouplingPenalty: number;
  };
  persistenceAnalysis: {
    relevantCommitCount: number;
    pairWeights: Array<{ rawCount: number; jaccard: number }>;
  };
  delta: number;
}

interface ComparisonEnvelope {
  result: LocalityComparisonResult;
  confidence: number;
  unknowns: string[];
}

interface RankingCase {
  kind: "control" | "advantage";
  evidenceLevel: "synthetic" | "repo_backed";
  id: string;
  build: () => Promise<{
    better: LocalityComparisonResult;
    worse: LocalityComparisonResult;
  }>;
}

interface DriftCase {
  kind: "robustness";
  id: string;
  maxDrift?: number;
  build: () => Promise<{
    baseline: LocalityComparisonResult;
    variant: LocalityComparisonResult;
  }>;
}

interface ConfidenceCase {
  kind: "confidence";
  id: string;
  maxConfidence?: number;
  maxLocalityScore?: number;
  requiredUnknownFragment: string;
  build: () => Promise<ComparisonEnvelope>;
}

interface DeterminismCase {
  kind: "determinism";
  id: string;
  build: () => Promise<{
    forward: ComparisonEnvelope;
    reversed: ComparisonEnvelope;
  }>;
}

type AcceptanceCase = RankingCase | DriftCase | ConfidenceCase | DeterminismCase;

interface AdvantageSummary {
  caseCount: number;
  elsMisclassifications: number;
  persistenceMisclassifications: number;
  improvementRate: number;
}

interface BenchmarkSummary {
  controlViolations: number;
  syntheticAdvantage: AdvantageSummary;
  repoBackedAdvantage: AdvantageSummary;
  robustnessViolations: number;
  confidenceViolations: number;
  determinismViolations: number;
  reasons: string[];
  verdict: "go" | "no_go";
}

describe("persistence adoption benchmark", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        await cleanupTemporaryRepo(root);
      }
    }
  });

  test("promotes the persistence candidate once repo-backed advantage evidence exists", async () => {
    const summary = await evaluateBenchmark(tempRoots);

    expect(summary.controlViolations).toBe(0);
    expect(summary.syntheticAdvantage.caseCount).toBeGreaterThanOrEqual(2);
    expect(summary.syntheticAdvantage.elsMisclassifications).toBeGreaterThan(
      summary.syntheticAdvantage.persistenceMisclassifications
    );
    expect(summary.syntheticAdvantage.improvementRate).toBeGreaterThanOrEqual(MIN_IMPROVEMENT_RATE);
    expect(summary.repoBackedAdvantage.caseCount).toBeGreaterThanOrEqual(MIN_REPO_BACKED_ADVANTAGE_CASES);
    expect(summary.repoBackedAdvantage.elsMisclassifications).toBeGreaterThan(
      summary.repoBackedAdvantage.persistenceMisclassifications
    );
    expect(summary.repoBackedAdvantage.improvementRate).toBeGreaterThanOrEqual(MIN_IMPROVEMENT_RATE);
    expect(summary.robustnessViolations).toBe(0);
    expect(summary.confidenceViolations).toBe(0);
    expect(summary.determinismViolations).toBe(0);
    expect(summary.reasons).toEqual([]);
    expect(summary.verdict).toBe("go");
  }, 20000);

  test("loads versioned external-repo shadow rollout manifests", async () => {
    const observations = await loadRealRepoObservations();
    const simPrismModel = await loadDomainModel(SIM_PRISM_MANIFEST_PATH);
    const pceMemoryModel = await loadDomainModel(PCE_MEMORY_MANIFEST_PATH);
    const zakkiModel = await loadDomainModel(ZAKKI_MANIFEST_PATH);
    const assayKitModel = await loadDomainModel(ASSAY_KIT_MANIFEST_PATH);
    const projectLogicaModel = await loadDomainModel(PROJECT_LOGICA_MANIFEST_PATH);

    expect(observations.map((entry) => entry.repoId)).toEqual([
      "context-probe",
      "sample_app",
      "sim_prism",
      "pce-memory",
      "zakki",
      "assay-kit",
      "project_logica"
    ]);
    expect(simPrismModel.contexts.map((context) => context.name)).toEqual([
      "CoreRuntime",
      "EnvironmentModeling",
      "BehaviorSystem",
      "AnalyticsAndExperiments",
      "PluginContracts",
      "APIAndBuilders"
    ]);
    expect(pceMemoryModel.contexts.map((context) => context.name)).toEqual([
      "RuntimeInterfaces",
      "DomainState",
      "HandlerPipeline",
      "SyncAndAudit",
      "PersistenceStore",
      "SearchAndEmbeddings"
    ]);
    expect(zakkiModel.contexts.map((context) => context.name)).toEqual([
      "MobileApp",
      "WebsiteApp",
      "WorkerBackend",
      "DataAndSchema"
    ]);
    expect(assayKitModel.contexts.map((context) => context.name)).toEqual([
      "CoreToolkit",
      "McpServer",
      "VerificationKit",
      "FormalSpecs"
    ]);
    expect(projectLogicaModel.contexts.map((context) => context.name)).toEqual([
      "CoreKernel",
      "RuntimeAndCli",
      "Integrations",
      "ServicePlugins",
      "WorkflowAgents",
      "SamplePlugins"
    ]);
  });

  test("keeps replacement in shadow rollout while real-repo drift variance remains high", async () => {
    const summary = evaluateRealRepoReplacementGate(await loadRealRepoObservations());

    expect(summary.repoCount).toBe(7);
    expect(summary.repoOwnedCount).toBe(2);
    expect(summary.versionedManifestCount).toBe(5);
    expect(summary.overall.positiveDeltaCount).toBe(6);
    expect(summary.overall.negativeDeltaCount).toBe(1);
    expect(summary.overall.averageDelta).toBeCloseTo(0.059910945945228024, 12);
    expect(summary.overall.weightedAverageDelta).toBeCloseTo(0.043210609174773186, 12);
    expect(summary.overall.medianDelta).toBeCloseTo(0.04821513002364075, 12);
    expect(summary.overall.minDelta).toBeCloseTo(-0.08938050770826689, 12);
    expect(summary.overall.maxDelta).toBeCloseTo(0.16615362732477523, 12);
    expect(summary.overall.deltaRange).toBeCloseTo(0.2555341350330421, 12);
    expect(summary.reasons).toEqual(["real_repo_delta_range_above_threshold"]);
    expect(summary.replacementVerdict).toBe("no_go");
    expect(summary.rolloutDisposition).toBe("shadow_only");
  });

  test("explains current delta range through application and tooling categories", async () => {
    const summary = evaluateRealRepoReplacementGate(await loadRealRepoObservations());
    const application = summary.categories.find((entry) => entry.category === "application");
    const tooling = summary.categories.find((entry) => entry.category === "tooling");

    expect(summary.categories.map((entry) => entry.category)).toEqual(["application", "tooling"]);
    expect(application).toBeDefined();
    expect(application?.repoIds).toEqual(["sample_app", "sim_prism", "zakki"]);
    expect(application?.summary.repoCount).toBe(3);
    expect(application?.summary.positiveDeltaCount).toBe(2);
    expect(application?.summary.negativeDeltaCount).toBe(1);
    expect(application?.summary.averageDelta).toBeCloseTo(0.00018893966387611982, 12);
    expect(application?.summary.minDelta).toBeCloseTo(-0.08938050770826689, 12);
    expect(application?.summary.maxDelta).toBeCloseTo(0.04821513002364075, 12);
    expect(application?.summary.deltaRange).toBeCloseTo(0.13759563773190764, 12);
    expect(application?.gate.reasons).toEqual([]);
    expect(application?.gate.replacementVerdict).toBe("go");
    expect(application?.gate.rolloutDisposition).toBe("replace");
    expect(tooling).toBeDefined();
    expect(tooling?.repoIds).toEqual(["context-probe", "pce-memory", "assay-kit", "project_logica"]);
    expect(tooling?.summary.repoCount).toBe(4);
    expect(tooling?.summary.positiveDeltaCount).toBe(4);
    expect(tooling?.summary.negativeDeltaCount).toBe(0);
    expect(tooling?.summary.averageDelta).toBeCloseTo(0.10470245065624172, 12);
    expect(tooling?.summary.weightedAverageDelta).toBeCloseTo(0.09927054919652575, 12);
    expect(tooling?.summary.minDelta).toBeCloseTo(0.03618532818532816, 12);
    expect(tooling?.summary.maxDelta).toBeCloseTo(0.16615362732477523, 12);
    expect(tooling?.summary.deltaRange).toBeCloseTo(0.12996829913944707, 12);
    expect(tooling?.gate.reasons).toEqual(["real_repo_weighted_average_delta_above_threshold"]);
    expect(tooling?.gate.replacementVerdict).toBe("no_go");
    expect(tooling?.gate.rolloutDisposition).toBe("shadow_only");
    expect(application?.summary.deltaRange ?? 1).toBeLessThanOrEqual(0.15);
    expect(tooling?.summary.deltaRange ?? 1).toBeLessThanOrEqual(0.15);
    expect(summary.overall.deltaRange).toBeGreaterThan(0.15);
  });
});

async function loadRealRepoObservations() {
  const registry = await loadShadowRolloutRegistry(REAL_REPO_REGISTRY_PATH);
  return registryToGateObservations(registry, REAL_REPO_REGISTRY_PATH);
}

async function evaluateBenchmark(tempRoots: string[]): Promise<BenchmarkSummary> {
  const cases = createAcceptanceCases(tempRoots);
  let controlViolations = 0;
  let robustnessViolations = 0;
  let confidenceViolations = 0;
  let determinismViolations = 0;
  const syntheticAdvantageResults: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }> = [];
  const repoBackedAdvantageResults: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }> = [];

  for (const entry of cases) {
    if (entry.kind === "control" || entry.kind === "advantage") {
      const result = await entry.build();
      const elsCorrect = scoresPreferBetter(result.better.els.score, result.worse.els.score);
      const persistenceCorrect = scoresPreferBetter(
        result.better.persistenceCandidate.localityScore,
        result.worse.persistenceCandidate.localityScore
      );

      if (entry.kind === "control" && (!elsCorrect || !persistenceCorrect)) {
        controlViolations += 1;
      }
      if (entry.kind === "advantage") {
        const bucket =
          entry.evidenceLevel === "repo_backed" ? repoBackedAdvantageResults : syntheticAdvantageResults;
        bucket.push({ elsCorrect, persistenceCorrect });
      }
      continue;
    }

    if (entry.kind === "robustness") {
      const result = await entry.build();
      const maxDrift = entry.maxDrift ?? DRIFT_TOLERANCE;
      const elsDrift = Math.abs(result.baseline.els.score - result.variant.els.score);
      const persistenceDrift = Math.abs(
        result.baseline.persistenceCandidate.localityScore -
          result.variant.persistenceCandidate.localityScore
      );

      if (elsDrift > maxDrift || persistenceDrift > maxDrift) {
        robustnessViolations += 1;
      }
      continue;
    }

    if (entry.kind === "confidence") {
      const result = await entry.build();
      const maxConfidence = entry.maxConfidence ?? MAX_THIN_HISTORY_CONFIDENCE;
      const maxLocalityScore = entry.maxLocalityScore ?? MAX_THIN_HISTORY_LOCALITY_SCORE;
      const hasRequiredUnknown = result.unknowns.some((unknown) =>
        unknown.includes(entry.requiredUnknownFragment)
      );

      if (
        result.confidence >= maxConfidence ||
        !hasRequiredUnknown ||
        result.result.persistenceCandidate.localityScore > maxLocalityScore
      ) {
        confidenceViolations += 1;
      }
      continue;
    }

    if (entry.kind === "determinism") {
      const result = await entry.build();
      if (
        JSON.stringify(result.forward.result) !== JSON.stringify(result.reversed.result) ||
        result.forward.confidence !== result.reversed.confidence ||
        JSON.stringify(result.forward.unknowns) !== JSON.stringify(result.reversed.unknowns)
      ) {
        determinismViolations += 1;
      }
    }
  }

  const syntheticAdvantage = summarizeAdvantages(syntheticAdvantageResults);
  const repoBackedAdvantage = summarizeAdvantages(repoBackedAdvantageResults);
  const reasons: string[] = [];

  if (controlViolations > 0) {
    reasons.push("control_regressions_detected");
  }
  if (robustnessViolations > 0) {
    reasons.push("robustness_violations_detected");
  }
  if (confidenceViolations > 0) {
    reasons.push("confidence_violations_detected");
  }
  if (determinismViolations > 0) {
    reasons.push("determinism_violations_detected");
  }
  if (repoBackedAdvantage.caseCount < MIN_REPO_BACKED_ADVANTAGE_CASES) {
    reasons.push("insufficient_repo_backed_advantage_evidence");
  }
  if (repoBackedAdvantage.elsMisclassifications === 0) {
    reasons.push("no_repo_backed_els_failures_observed");
  }
  if (repoBackedAdvantage.persistenceMisclassifications >= repoBackedAdvantage.elsMisclassifications) {
    reasons.push("persistence_does_not_beat_repo_backed_els");
  }
  if (repoBackedAdvantage.improvementRate < MIN_IMPROVEMENT_RATE) {
    reasons.push("repo_backed_improvement_below_threshold");
  }

  return {
    controlViolations,
    syntheticAdvantage,
    repoBackedAdvantage,
    robustnessViolations,
    confidenceViolations,
    determinismViolations,
    reasons,
    verdict: reasons.length === 0 ? "go" : "no_go"
  };
}

function summarizeAdvantages(
  results: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }>
): AdvantageSummary {
  const caseCount = results.length;
  const elsMisclassifications = results.filter((entry) => !entry.elsCorrect).length;
  const persistenceMisclassifications = results.filter((entry) => !entry.persistenceCorrect).length;
  const improvementRate =
    elsMisclassifications === 0
      ? 0
      : (elsMisclassifications - persistenceMisclassifications) / elsMisclassifications;

  return {
    caseCount,
    elsMisclassifications,
    persistenceMisclassifications,
    improvementRate
  };
}

function evaluateRealRepoReplacementGate(observations: Awaited<ReturnType<typeof loadRealRepoObservations>>): DomainDesignShadowRolloutGateEvaluation {
  return evaluateShadowRolloutGate(observations);
}

function scoresPreferBetter(better: number, worse: number): boolean {
  return better - worse > TIE_TOLERANCE;
}

function createAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    {
      kind: "control",
      evidenceLevel: "repo_backed",
      id: "localized-vs-scattered",
      build: async () => {
        const localRepo = await materializeGitFixture(tempRoots, "feat: init localized benchmark");
        const scatteredRepo = await materializeGitFixture(tempRoots, "feat: init scattered benchmark");

        await appendAndCommit(
          localRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingLocalizedOne = 'billing-l1';\n"
          },
          "feat: billing localized 1"
        );
        await appendAndCommit(
          localRepo,
          {
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentLocalizedOne = 'fulfillment-l1';\n"
          },
          "feat: fulfillment localized 1"
        );
        await appendAndCommit(
          localRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingLocalizedTwo = 'billing-l2';\n"
          },
          "feat: billing localized 2"
        );

        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredOne = 'billing-s1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredOne = 'fulfillment-s1';\n"
          },
          "feat: cross-context scattered 1"
        );
        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredTwo = 'billing-s2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredTwo = 'fulfillment-s2';\n"
          },
          "feat: cross-context scattered 2"
        );
        await appendAndCommit(
          scatteredRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingScatteredThree = 'billing-s3';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentScatteredThree = 'fulfillment-s3';\n"
          },
          "feat: cross-context scattered 3"
        );

        return {
          better: (await compareLocality(localRepo)).result,
          worse: (await compareLocality(scatteredRepo)).result
        };
      }
    },
    {
      kind: "control",
      evidenceLevel: "synthetic",
      id: "hub-vs-balanced-pair",
      build: async () => ({
        better: compareCommits(hubCommits()).result,
        worse: compareCommits(balancedPersistentPairCommits()).result
      })
    },
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "rotating-pairs-vs-stable-pair",
      build: async () => ({
        better: compareCommits(rotatingPairCommits()).result,
        worse: compareCommits(stablePairCommits()).result
      })
    },
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "partially-concentrated-vs-stable-pair",
      build: async () => ({
        better: compareCommits(partiallyConcentratedCommits()).result,
        worse: compareCommits(stablePairCommits()).result
      })
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-rotating-pairs-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable pair repo");
        const rotating = await buildThreeContextRepo(tempRoots, "feat: init rotating pair repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(rotating.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable");
        await applyRotatingPairPattern(rotating.repoPath, "rotating");

        return {
          better: (await compareLocality(rotating.repoPath, rotating.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result
        };
      }
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-partially-concentrated-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable partial repo");
        const partial = await buildThreeContextRepo(tempRoots, "feat: init partial concentration repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(partial.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable-partial");
        await applyPartiallyConcentratedPattern(partial.repoPath, "partial");

        return {
          better: (await compareLocality(partial.repoPath, partial.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result
        };
      }
    },
    {
      kind: "robustness",
      id: "rename-heavy-same-context",
      build: async () => {
        const baselineRepo = await materializeGitFixture(tempRoots, "feat: init baseline rename");
        const renamedRepo = await materializeGitFixture(tempRoots, "feat: init renamed variant");

        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaseline = 'baseline';\n"
          },
          "refactor: billing baseline"
        );
        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaselineOne = 'baseline-r1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameBaselineOne = 'baseline-r1';\n"
          },
          "feat: rename baseline 1"
        );
        await appendAndCommit(
          baselineRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingRenameBaselineTwo = 'baseline-r2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameBaselineTwo = 'baseline-r2';\n"
          },
          "feat: rename baseline 2"
        );

        await renameAndCommit(
          renamedRepo,
          "src/billing/internal/billing-service.ts",
          "src/billing/internal/billing-renamed-service.ts",
          "refactor: rename billing service"
        );
        await appendAndCommit(
          renamedRepo,
          {
            "src/billing/internal/billing-renamed-service.ts": "\nexport const billingRenameVariantOne = 'variant-r1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameVariantOne = 'variant-r1';\n"
          },
          "feat: rename variant 1"
        );
        await appendAndCommit(
          renamedRepo,
          {
            "src/billing/internal/billing-renamed-service.ts": "\nexport const billingRenameVariantTwo = 'variant-r2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentRenameVariantTwo = 'variant-r2';\n"
          },
          "feat: rename variant 2"
        );

        return {
          baseline: (await compareLocality(baselineRepo)).result,
          variant: (await compareLocality(renamedRepo)).result
        };
      }
    },
    {
      kind: "robustness",
      id: "merge-only-noise",
      build: async () => {
        const linearRepo = await materializeGitFixture(tempRoots, "feat: init linear control");
        const mergedRepo = await materializeGitFixture(tempRoots, "feat: init merged variant");

        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinear = 'billing-merge-linear';\n"
          },
          "refactor: billing merge control"
        );
        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearOne = 'billing-m1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearOne = 'fulfillment-m1';\n"
          },
          "feat: merge control 1"
        );
        await appendAndCommit(
          linearRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearTwo = 'billing-m2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearTwo = 'fulfillment-m2';\n"
          },
          "feat: merge control 2"
        );

        await commitOnBranchAndMerge(
          mergedRepo,
          "feature/merge-noise",
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinear = 'billing-merge-linear';\n"
          },
          "refactor: billing merge control",
          "merge: merge billing refactor branch"
        );
        await appendAndCommit(
          mergedRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearOne = 'billing-m1';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearOne = 'fulfillment-m1';\n"
          },
          "feat: merge control 1"
        );
        await appendAndCommit(
          mergedRepo,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingMergeLinearTwo = 'billing-m2';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentMergeLinearTwo = 'fulfillment-m2';\n"
          },
          "feat: merge control 2"
        );

        return {
          baseline: (await compareLocality(linearRepo)).result,
          variant: (await compareLocality(mergedRepo)).result
        };
      }
    },
    {
      kind: "confidence",
      id: "thin-history",
      requiredUnknownFragment: "thin",
      build: async () => {
        const repoPath = await materializeGitFixture(tempRoots, "feat: init thin benchmark");
        await appendAndCommit(
          repoPath,
          {
            "src/billing/internal/billing-service.ts": "\nexport const billingThinOne = 'billing-thin';\n",
            "src/fulfillment/internal/fulfillment-service.ts":
              "\nexport const fulfillmentThinOne = 'fulfillment-thin';\n"
          },
          "feat: thin cross-context update"
        );
        return compareLocality(repoPath);
      }
    },
    {
      kind: "determinism",
      id: "commit-order-invariant",
      build: async () => {
        const commits = [
          commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
          commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
          commit("ac1", ["src/billing/c.ts", "src/support/c.ts"]),
          commit("a1", ["src/billing/local.ts"]),
          commit("s1", ["src/support/local.ts"])
        ];

        return {
          forward: compareCommits(commits),
          reversed: compareCommits([...commits].reverse())
        };
      }
    }
  ];
}

function commit(hash: string, files: string[]): CochangeCommit {
  return {
    hash,
    subject: hash,
    files
  };
}

function stablePairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ab3", ["src/billing/c.ts", "src/fulfillment/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"])
  ];
}

function rotatingPairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ac1", ["src/billing/b.ts", "src/support/b.ts"]),
    commit("bc1", ["src/fulfillment/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"])
  ];
}

function partiallyConcentratedCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ac1", ["src/billing/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"])
  ];
}

function hubCommits(): CochangeCommit[] {
  return [
    commit("s1", ["src/support/ticket.ts"]),
    commit("s2", ["src/support/escalation.ts"]),
    commit("bs1", ["src/billing/a.ts", "src/support/a.ts"]),
    commit("bs2", ["src/billing/b.ts", "src/support/b.ts"]),
    commit("fs1", ["src/fulfillment/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"])
  ];
}

function balancedPersistentPairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ab3", ["src/billing/c.ts", "src/fulfillment/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"])
  ];
}

function compareCommits(commits: CochangeCommit[]): ComparisonEnvelope {
  const result = compareEvolutionLocalityModels(commits, SYNTHETIC_MODEL);
  return {
    result: result.comparison,
    confidence: result.confidence,
    unknowns: result.unknowns
  };
}

async function compareLocality(repoPath: string, modelPath = ELS_MODEL_PATH): Promise<ComparisonEnvelope> {
  const response = await COMMANDS["history.compare_locality_models"]!(
    {
      repo: repoPath,
      model: modelPath,
      policy: POLICY_PATH
    },
    { cwd: process.cwd() }
  );

  return {
    result: response.result as LocalityComparisonResult,
    confidence: response.confidence,
    unknowns: response.unknowns
  };
}

async function materializeGitFixture(tempRoots: string[], initialCommitMessage: string): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([ELS_BASE_ENTRY]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, ELS_BASE_ENTRY);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

async function buildThreeContextRepo(
  tempRoots: string[],
  initialCommitMessage: string
): Promise<{ repoPath: string; modelPath: string }> {
  const repoPath = await materializeGitFixture(tempRoots, initialCommitMessage);
  const modelPath = path.join(repoPath, "three-context-model.yaml");
  await writeFile(
    modelPath,
    [
      'version: "1.0"',
      "contexts:",
      "  - name: Billing",
      "    pathGlobs:",
      '      - "src/billing/**"',
      "  - name: Fulfillment",
      "    pathGlobs:",
      '      - "src/fulfillment/**"',
      "  - name: Support",
      "    pathGlobs:",
      '      - "src/support/**"'
    ].join("\n"),
    "utf8"
  );
  return { repoPath, modelPath };
}

async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const current = await readFile(targetPath, "utf8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    });
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await commitAll(repoPath, message);
}

async function applySupportLocalityBaseline(repoPath: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/support/internal/support-service.ts":
        "export const supportService = () => 'support-baseline';\n"
    },
    "feat: add support context"
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": "\nexport const billingRepoLocal = 'billing-local';\n"
    },
    "feat: billing local baseline"
  );
  await appendAndCommit(
    repoPath,
    {
      "src/fulfillment/internal/fulfillment-service.ts":
        "\nexport const fulfillmentRepoLocal = 'fulfillment-local';\n"
    },
    "feat: fulfillment local baseline"
  );
}

async function applyStablePairPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}StableFulfillmentOne = "${prefix}-ab1";\n`
    },
    `feat: ${prefix} stable pair 1`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingTwo = "${prefix}-ab2";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}StableFulfillmentTwo = "${prefix}-ab2";\n`
    },
    `feat: ${prefix} stable pair 2`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}StableBillingThree = "${prefix}-ab3";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}StableFulfillmentThree = "${prefix}-ab3";\n`
    },
    `feat: ${prefix} stable pair 3`
  );
}

async function applyRotatingPairPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}FulfillmentBillingOne = "${prefix}-ab1";\n`
    },
    `feat: ${prefix} rotating pair ab`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingSupportOne = "${prefix}-ac1";\n`,
      "src/support/internal/support-service.ts":
        `\nexport const ${prefix}SupportBillingOne = "${prefix}-ac1";\n`
    },
    `feat: ${prefix} rotating pair ac`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}FulfillmentSupportOne = "${prefix}-bc1";\n`,
      "src/support/internal/support-service.ts":
        `\nexport const ${prefix}SupportFulfillmentOne = "${prefix}-bc1";\n`
    },
    `feat: ${prefix} rotating pair bc`
  );
}

async function applyPartiallyConcentratedPattern(repoPath: string, prefix: string): Promise<void> {
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentOne = "${prefix}-ab1";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}FulfillmentBillingOne = "${prefix}-ab1";\n`
    },
    `feat: ${prefix} concentrated pair 1`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingFulfillmentTwo = "${prefix}-ab2";\n`,
      "src/fulfillment/internal/fulfillment-service.ts":
        `\nexport const ${prefix}FulfillmentBillingTwo = "${prefix}-ab2";\n`
    },
    `feat: ${prefix} concentrated pair 2`
  );
  await appendAndCommit(
    repoPath,
    {
      "src/billing/internal/billing-service.ts": `\nexport const ${prefix}BillingSupportOne = "${prefix}-ac1";\n`,
      "src/support/internal/support-service.ts":
        `\nexport const ${prefix}SupportBillingOne = "${prefix}-ac1";\n`
    },
    `feat: ${prefix} concentrated spillover`
  );
}

async function renameAndCommit(repoPath: string, fromPath: string, toPath: string, message: string): Promise<void> {
  await rename(path.join(repoPath, fromPath), path.join(repoPath, toPath));
  await commitAll(repoPath, message);
}

async function commitOnBranchAndMerge(
  repoPath: string,
  branchName: string,
  updates: Record<string, string>,
  commitMessage: string,
  mergeMessage: string
): Promise<void> {
  const currentBranch = await getCurrentBranch(repoPath);
  await runGit(repoPath, ["checkout", "-b", branchName]);
  await appendAndCommit(repoPath, updates, commitMessage);
  await runGit(repoPath, ["checkout", currentBranch]);
  await runGitWithIdentity(repoPath, ["merge", "--no-ff", branchName, "-m", mergeMessage]);
}

async function commitAll(repoPath: string, message: string): Promise<void> {
  await runGit(repoPath, ["add", "-A"]);
  await runGitWithIdentity(repoPath, ["commit", "-m", message]);
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execFile("git", ["branch", "--show-current"], { cwd: repoPath });
  return stdout.trim();
}

async function runGit(repoPath: string, args: string[]): Promise<void> {
  await execFile("git", args, { cwd: repoPath });
}

async function runGitWithIdentity(repoPath: string, args: string[]): Promise<void> {
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", ...args],
    { cwd: repoPath }
  );
}
