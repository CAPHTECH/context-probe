import path from "node:path";

import type { DomainDesignShadowRolloutGateEvaluation, DomainModel } from "../src/core/contracts.js";
import { loadDomainModel } from "../src/core/model.js";
import {
  evaluateShadowRolloutGate,
  loadShadowRolloutRegistry,
  registryToGateObservations,
} from "../src/core/shadow-rollout.js";
import { cleanupTemporaryRepo } from "./helpers.js";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
export const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";

const TIE_TOLERANCE = 0.02;
export const DRIFT_TOLERANCE = 0.05;
export const MAX_THIN_HISTORY_CONFIDENCE = 0.75;
export const MAX_THIN_HISTORY_LOCALITY_SCORE = 0.5;
export const MIN_REPO_BACKED_ADVANTAGE_CASES = 2;
export const MIN_IMPROVEMENT_RATE = 0.2;

const REAL_REPO_REGISTRY_PATH = path.resolve("fixtures/validation/shadow-rollout/registry.yaml");
const SIM_PRISM_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/sim_prism-domain-model.yaml");
const PCE_MEMORY_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/pce-memory-domain-model.yaml");
const ZAKKI_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/zakki-domain-model.yaml");
const ASSAY_KIT_MANIFEST_PATH = path.resolve("fixtures/validation/shadow-rollout/assay-kit-domain-model.yaml");
const PROJECT_LOGICA_MANIFEST_PATH = path.resolve(
  "fixtures/validation/shadow-rollout/project_logica-domain-model.yaml",
);

export const SYNTHETIC_MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] },
  ],
};

export interface LocalityComparisonResult {
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

export interface ComparisonEnvelope {
  result: LocalityComparisonResult;
  confidence: number;
  unknowns: string[];
}

export interface RankingCase {
  kind: "control" | "advantage";
  evidenceLevel: "synthetic" | "repo_backed";
  id: string;
  build: () => Promise<{
    better: LocalityComparisonResult;
    worse: LocalityComparisonResult;
  }>;
}

export interface DriftCase {
  kind: "robustness";
  id: string;
  maxDrift?: number;
  build: () => Promise<{
    baseline: LocalityComparisonResult;
    variant: LocalityComparisonResult;
  }>;
}

export interface ConfidenceCase {
  kind: "confidence";
  id: string;
  maxConfidence?: number;
  maxLocalityScore?: number;
  requiredUnknownFragment: string;
  build: () => Promise<ComparisonEnvelope>;
}

export interface DeterminismCase {
  kind: "determinism";
  id: string;
  build: () => Promise<{
    forward: ComparisonEnvelope;
    reversed: ComparisonEnvelope;
  }>;
}

export type AcceptanceCase = RankingCase | DriftCase | ConfidenceCase | DeterminismCase;

export interface AdvantageSummary {
  caseCount: number;
  elsMisclassifications: number;
  persistenceMisclassifications: number;
  improvementRate: number;
}

export interface BenchmarkSummary {
  controlViolations: number;
  syntheticAdvantage: AdvantageSummary;
  repoBackedAdvantage: AdvantageSummary;
  robustnessViolations: number;
  confidenceViolations: number;
  determinismViolations: number;
  reasons: string[];
  verdict: "go" | "no_go";
}

export async function cleanupPersistenceTempRoots(tempRoots: string[]): Promise<void> {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await cleanupTemporaryRepo(root);
    }
  }
}

export async function loadRealRepoObservations() {
  const registry = await loadShadowRolloutRegistry(REAL_REPO_REGISTRY_PATH);
  return registryToGateObservations(registry, REAL_REPO_REGISTRY_PATH);
}

export function evaluateRealRepoReplacementGate(
  observations: Awaited<ReturnType<typeof loadRealRepoObservations>>,
): DomainDesignShadowRolloutGateEvaluation {
  return evaluateShadowRolloutGate(observations);
}

export function scoresPreferBetter(better: number, worse: number): boolean {
  return better - worse > TIE_TOLERANCE;
}

export function summarizeAdvantages(
  results: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }>,
): AdvantageSummary {
  const caseCount = results.length;
  const elsMisclassifications = results.filter((entry) => !entry.elsCorrect).length;
  const persistenceMisclassifications = results.filter((entry) => !entry.persistenceCorrect).length;
  const improvementRate =
    elsMisclassifications === 0 ? 0 : (elsMisclassifications - persistenceMisclassifications) / elsMisclassifications;

  return {
    caseCount,
    elsMisclassifications,
    persistenceMisclassifications,
    improvementRate,
  };
}

export async function loadRealRepoManifestModels() {
  const [simPrismModel, pceMemoryModel, zakkiModel, assayKitModel, projectLogicaModel] = await Promise.all([
    loadDomainModel(SIM_PRISM_MANIFEST_PATH),
    loadDomainModel(PCE_MEMORY_MANIFEST_PATH),
    loadDomainModel(ZAKKI_MANIFEST_PATH),
    loadDomainModel(ASSAY_KIT_MANIFEST_PATH),
    loadDomainModel(PROJECT_LOGICA_MANIFEST_PATH),
  ]);
  return { simPrismModel, pceMemoryModel, zakkiModel, assayKitModel, projectLogicaModel };
}
