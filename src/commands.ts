import { promises as fs } from "node:fs";
import path from "node:path";
import { detectDirectionViolations, scoreDependencyDirection } from "./analyzers/architecture.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "./analyzers/code.js";
import type { CommandArgs } from "./command-helpers.js";
import {
  buildExtractionOptions,
  getDocsRoot,
  getProfile,
  getRootPath,
  parseTieTolerance,
  requireArchitectureConstraints,
  requireDomainModel,
  requireShadowRolloutBatchSpec,
  requireShadowRolloutRegistry,
  resolveSpecRelativePath,
} from "./command-helpers.js";
import { handleScoreCompute } from "./command-score.js";
import { handleGateEvaluate, handleReportGenerate, handleReviewListUnknowns } from "./command-score-driven.js";
import { normalizeDocuments, registerArtifacts } from "./core/artifacts.js";
import type {
  CommandContext,
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutBatchResult,
  DomainDesignShadowRolloutGateResult,
  DomainDesignShadowRolloutObservation,
  ReviewItem,
  ReviewResolution,
} from "./core/contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./core/document-extractors.js";
import {
  analyzeCochangePersistence,
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality,
  normalizeHistory,
  scoreEvolutionLocality,
} from "./core/history.js";
import { readDataFile } from "./core/io.js";
import { loadPolicyConfig } from "./core/policy.js";
import { confidenceFromSignals, createResponse, mergeStatus, toProvenance } from "./core/response.js";
import { resolveReviewItems } from "./core/review.js";
import { scaffoldArchitectureConstraints, scaffoldDomainModel } from "./core/scaffold.js";
import {
  batchToGateObservations,
  evaluateShadowRolloutGate,
  inferShadowRolloutModelSource,
  loadShadowRolloutRegistry,
  registryToGateObservations,
  summarizeShadowRolloutBatchObservations,
} from "./core/shadow-rollout.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./core/trace.js";

export type CommandHandler = (args: CommandArgs, context: CommandContext) => Promise<CommandResponse<unknown>>;

export const COMMANDS: Record<string, CommandHandler> = {
  async "ingest.register_artifacts"(args, context) {
    const artifacts = await registerArtifacts(getRootPath(args, context));
    return createResponse({ artifacts }, { provenance: [toProvenance(context.cwd, "artifact_registry")] });
  },

  async "ingest.normalize_documents"(args, context) {
    const fragments = await normalizeDocuments(getDocsRoot(args, context));
    return createResponse({ fragments }, { provenance: [toProvenance(context.cwd, "document_fragments")] });
  },

  async "ingest.normalize_history"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    return createResponse({ commits }, { provenance: [toProvenance(context.cwd, "history_registry")] });
  },

  async "model.load"(args, context) {
    const model = await requireDomainModel(args, context);
    return createResponse(model, { provenance: [toProvenance(context.cwd, "domain_model")] });
  },

  async "model.scaffold"(args, context) {
    const repoRoot = getRootPath(args, context);
    const docsRoot = typeof args["docs-root"] === "string" ? getDocsRoot(args, context) : undefined;
    const scaffold = await scaffoldDomainModel({
      repoRoot,
      ...(docsRoot ? { docsRoot, extractionOptions: await buildExtractionOptions(args, context) } : {}),
    });
    return createResponse(scaffold.result, {
      status: scaffold.unknowns.length > 0 ? "warning" : "ok",
      evidence: scaffold.evidence,
      confidence: scaffold.confidence,
      unknowns: scaffold.unknowns,
      diagnostics: scaffold.diagnostics,
      provenance: [
        toProvenance(repoRoot, "domain_model_scaffold"),
        ...(docsRoot ? [toProvenance(docsRoot, "domain_model_scaffold_docs")] : []),
      ],
    });
  },

  async "doc.extract_glossary"(args, context) {
    const glossary = await extractGlossary(await buildExtractionOptions(args, context));
    return createResponse(glossary, {
      status: glossary.diagnostics.length > 0 ? "warning" : "ok",
      evidence: glossary.terms.flatMap((term) => term.evidence),
      confidence: glossary.confidence,
      unknowns: glossary.unknowns,
      diagnostics: glossary.diagnostics,
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_glossary")],
    });
  },

  async "doc.extract_rules"(args, context) {
    const rules = await extractRules(await buildExtractionOptions(args, context));
    return createResponse(rules, {
      status: rules.diagnostics.length > 0 ? "warning" : "ok",
      evidence: rules.rules.flatMap((rule) => rule.evidence),
      confidence: rules.confidence,
      unknowns: rules.unknowns,
      diagnostics: rules.diagnostics,
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_rules")],
    });
  },

  async "doc.extract_invariants"(args, context) {
    const invariants = await extractInvariants(await buildExtractionOptions(args, context));
    return createResponse(invariants, {
      status: invariants.diagnostics.length > 0 ? "warning" : "ok",
      evidence: invariants.invariants.flatMap((invariant) => invariant.evidence),
      confidence: invariants.confidence,
      unknowns: invariants.unknowns,
      diagnostics: invariants.diagnostics,
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_invariants")],
    });
  },

  async "trace.link_terms"(args, context) {
    const glossary = await extractGlossary(await buildExtractionOptions(args, context));
    const codebase = typeof args.repo === "string" ? await parseCodebase(getRootPath(args, context)) : undefined;
    const links = await buildTermTraceLinks({
      docsRoot: getDocsRoot(args, context),
      ...(typeof args.repo === "string" ? { repoRoot: getRootPath(args, context) } : {}),
      ...(codebase ? { codeFiles: codebase.scorableSourceFiles } : {}),
      terms: glossary.terms,
    });
    return createResponse(
      {
        links,
        glossary: glossary.terms,
        metadata: glossary.metadata,
      },
      {
        status: glossary.diagnostics.length > 0 ? "warning" : "ok",
        evidence: glossary.terms.flatMap((term) => term.evidence),
        confidence: glossary.confidence,
        unknowns: glossary.unknowns,
        diagnostics: glossary.diagnostics,
        provenance: [toProvenance(getDocsRoot(args, context), "trace.link_terms")],
      },
    );
  },

  async "trace.link_model_to_code"(args, context) {
    const model = await requireDomainModel(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(
      {
        links: buildModelCodeLinks(model, codebase.scorableSourceFiles),
      },
      {
        provenance: [toProvenance(getRootPath(args, context), "trace.link_model_to_code")],
      },
    );
  },

  async "code.parse"(args, context) {
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(codebase);
  },

  async "code.detect_dependencies"(args, context) {
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse({ dependencies: codebase.dependencies });
  },

  async "code.detect_contract_usage"(args, context) {
    const model = await requireDomainModel(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(detectContractUsage(codebase, model));
  },

  async "code.detect_boundary_leaks"(args, context) {
    const model = await requireDomainModel(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse({ findings: detectBoundaryLeaks(codebase, model) });
  },

  async "history.mine_cochange"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    return createResponse({ commits });
  },

  async "history.score_evolution_locality"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const analysis = scoreEvolutionLocality(commits, model);
    const quality = evaluateEvolutionLocalityObservationQuality(commits, model);
    return createResponse(analysis, {
      confidence: quality.confidence,
      unknowns: quality.unknowns,
    });
  },

  async "history.analyze_persistence"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const result = analyzeCochangePersistence(commits, model);
    return createResponse(result.analysis, {
      confidence: result.confidence,
      unknowns: result.unknowns,
    });
  },

  async "history.compare_locality_models"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const result = compareEvolutionLocalityModels(commits, model);
    return createResponse(result.comparison, {
      confidence: result.confidence,
      unknowns: result.unknowns,
    });
  },

  async "arch.load_topology"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    return createResponse(constraints);
  },

  async "constraints.scaffold"(args, context) {
    const repoRoot = getRootPath(args, context);
    const scaffold = await scaffoldArchitectureConstraints({ repoRoot });
    return createResponse(scaffold.result, {
      status: scaffold.unknowns.length > 0 ? "warning" : "ok",
      evidence: scaffold.evidence,
      confidence: scaffold.confidence,
      unknowns: scaffold.unknowns,
      diagnostics: scaffold.diagnostics,
      provenance: [toProvenance(repoRoot, "architecture_constraints_scaffold")],
    });
  },

  async "arch.detect_direction_violations"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse({ violations: detectDirectionViolations(codebase, constraints) });
  },

  async "arch.score_dependency_direction"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(scoreDependencyDirection(codebase, constraints));
  },

  "score.compute": handleScoreCompute,

  async "score.observe_shadow_rollout"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }

    const {
      "pilot-persistence": _pilotPersistence,
      "rollout-category": _rolloutCategory,
      "shadow-rollout-registry": _shadowRolloutRegistry,
      registry: _registry,
      ...shadowArgs
    } = args;

    const scoreResponse = (await scoreCompute(
      {
        ...shadowArgs,
        domain: "domain_design",
        "shadow-persistence": true,
      },
      context,
    )) as CommandResponse<DomainDesignScoreResult>;

    const elsMetric = scoreResponse.result.metrics.find((metric) => metric.metricId === "ELS");
    if (!elsMetric) {
      throw new Error("ELS metric is not available in the current domain score response");
    }
    if (!scoreResponse.result.shadow) {
      throw new Error("Shadow persistence payload is not available in the current domain score response");
    }

    const tieTolerance = typeof args["tie-tolerance"] === "string" ? Number.parseFloat(args["tie-tolerance"]) : 0.02;
    const safeTieTolerance = Number.isFinite(tieTolerance) && tieTolerance >= 0 ? tieTolerance : 0.02;
    const baselineElsValue = scoreResponse.result.pilot?.baselineElsValue ?? elsMetric.value;
    const policyDelta =
      scoreResponse.result.shadow.localityModels.persistenceCandidate.localityScore - baselineElsValue;
    const driftCategory =
      Math.abs(policyDelta) <= safeTieTolerance ? "aligned" : policyDelta > 0 ? "candidate_higher" : "candidate_lower";

    return createResponse<DomainDesignShadowRolloutObservation>(
      {
        domainId: "domain_design",
        metricId: "ELS",
        elsMetric,
        shadow: scoreResponse.result.shadow,
        observation: {
          policyDelta,
          modelDelta: scoreResponse.result.shadow.localityModels.delta,
          driftCategory,
          tieTolerance: safeTieTolerance,
        },
        history: scoreResponse.result.history,
        crossContextReferences: scoreResponse.result.crossContextReferences,
      },
      {
        status: scoreResponse.status,
        evidence: scoreResponse.evidence,
        confidence: scoreResponse.confidence,
        unknowns: scoreResponse.unknowns,
        diagnostics: scoreResponse.diagnostics,
        provenance: scoreResponse.provenance,
      },
    );
  },

  async "score.observe_shadow_rollout_batch"(args, context) {
    const observeShadowRollout = COMMANDS["score.observe_shadow_rollout"];
    if (!observeShadowRollout) {
      throw new Error("score.observe_shadow_rollout is not registered");
    }

    const { spec, specPath } = await requireShadowRolloutBatchSpec(args, context);
    const specDirectory = path.dirname(specPath);
    const argPolicyPath =
      typeof args.policy === "string" ? new URL(args.policy, `file://${context.cwd}/`).pathname : undefined;
    const argTieTolerance = parseTieTolerance(
      typeof args["tie-tolerance"] === "string" ? args["tie-tolerance"] : undefined,
    );

    const observations: DomainDesignShadowRolloutBatchObservation[] = [];
    const statuses = new Set<CommandResponse<unknown>["status"]>();
    const unknowns = new Set<string>();
    const diagnostics = new Set<string>();
    const confidenceSignals: number[] = [];

    for (const entry of spec.entries) {
      const repoPath = resolveSpecRelativePath(specDirectory, entry.repo);
      const modelPath = resolveSpecRelativePath(specDirectory, entry.model);
      const resolvedPolicyInput = entry.policy
        ? resolveSpecRelativePath(specDirectory, entry.policy)
        : spec.policy
          ? resolveSpecRelativePath(specDirectory, spec.policy)
          : argPolicyPath;

      if (!resolvedPolicyInput) {
        throw new Error(`Shadow rollout batch entry \`${entry.repoId}\` is missing a policy path`);
      }

      const tieTolerance =
        parseTieTolerance(entry.tieTolerance) ?? parseTieTolerance(spec.tieTolerance) ?? argTieTolerance;

      const response = (await observeShadowRollout(
        {
          repo: repoPath,
          model: modelPath,
          policy: resolvedPolicyInput,
          ...(tieTolerance !== undefined ? { "tie-tolerance": String(tieTolerance) } : {}),
        },
        context,
      )) as CommandResponse<DomainDesignShadowRolloutObservation>;

      const category = entry.category ?? "uncategorized";
      statuses.add(response.status);
      confidenceSignals.push(response.confidence);
      response.unknowns.forEach((unknown) => {
        unknowns.add(`${entry.repoId}: ${unknown}`);
      });
      response.diagnostics.forEach((diagnostic) => {
        diagnostics.add(`${entry.repoId}: ${diagnostic}`);
      });

      observations.push({
        repoId: entry.repoId,
        ...(entry.label ? { label: entry.label } : {}),
        category,
        modelSource: entry.modelSource ?? inferShadowRolloutModelSource(modelPath),
        repoPath,
        modelPath,
        policyPath: resolvedPolicyInput,
        status: response.status,
        elsMetric: response.result.elsMetric.value,
        persistenceLocalityScore: response.result.shadow.localityModels.persistenceCandidate.localityScore,
        policyDelta: response.result.observation.policyDelta,
        modelDelta: response.result.observation.modelDelta,
        driftCategory: response.result.observation.driftCategory,
        relevantCommitCount: response.result.shadow.localityModels.persistenceAnalysis.relevantCommitCount,
        confidence: response.confidence,
        unknowns: response.unknowns,
      });
    }

    const categories = Array.from(
      observations
        .reduce((groups, observation) => {
          const existing = groups.get(observation.category) ?? [];
          existing.push(observation);
          groups.set(observation.category, existing);
          return groups;
        }, new Map<string, DomainDesignShadowRolloutBatchObservation[]>())
        .entries(),
    ).map(([category, categoryObservations]) => ({
      category,
      repoIds: categoryObservations.map((entry) => entry.repoId),
      summary: summarizeShadowRolloutBatchObservations(categoryObservations),
    }));

    return createResponse<DomainDesignShadowRolloutBatchResult>(
      {
        observations,
        categories,
        overall: summarizeShadowRolloutBatchObservations(observations),
      },
      {
        status: mergeStatus(...statuses),
        confidence: confidenceFromSignals(confidenceSignals),
        unknowns: Array.from(unknowns),
        diagnostics: Array.from(diagnostics),
        provenance: [toProvenance(specPath, "shadow rollout batch spec")],
      },
    );
  },

  async "gate.evaluate_shadow_rollout"(args, context) {
    const observeShadowRolloutBatch = COMMANDS["score.observe_shadow_rollout_batch"];
    if (!observeShadowRolloutBatch) {
      throw new Error("score.observe_shadow_rollout_batch is not registered");
    }

    if (typeof args["batch-spec"] === "string") {
      const response = (await observeShadowRolloutBatch(
        args,
        context,
      )) as CommandResponse<DomainDesignShadowRolloutBatchResult>;
      const evaluation = evaluateShadowRolloutGate(batchToGateObservations(response.result.observations));

      return createResponse<DomainDesignShadowRolloutGateResult>(
        {
          source: "batch_spec",
          batchSpecPath: new URL(args["batch-spec"], `file://${context.cwd}/`).pathname,
          evaluation,
        },
        {
          status: evaluation.rolloutDisposition === "replace" ? response.status : "warning",
          evidence: response.evidence,
          confidence: response.confidence,
          unknowns: response.unknowns,
          diagnostics: response.diagnostics,
          provenance: response.provenance,
        },
      );
    }

    const { registry, registryPath } = await requireShadowRolloutRegistry(args, context, loadShadowRolloutRegistry);
    const evaluation = evaluateShadowRolloutGate(registryToGateObservations(registry, registryPath));

    return createResponse<DomainDesignShadowRolloutGateResult>(
      {
        source: "registry",
        registryPath,
        evaluation,
      },
      {
        status: evaluation.rolloutDisposition === "replace" ? "ok" : "warning",
        provenance: [toProvenance(registryPath, "shadow rollout registry")],
      },
    );
  },

  async "review.list_unknowns"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleReviewListUnknowns(args, context, scoreCompute, COMMANDS);
  },

  async "review.resolve"(args, context) {
    const reviewItemsPath =
      typeof args["review-items"] === "string"
        ? new URL(args["review-items"], `file://${context.cwd}/`).pathname
        : undefined;
    const resolutionsPath =
      typeof args.resolutions === "string" ? new URL(args.resolutions, `file://${context.cwd}/`).pathname : undefined;
    if (!reviewItemsPath || !resolutionsPath) {
      throw new Error("`--review-items` and `--resolutions` are required");
    }
    const reviewItemsPayload = await readDataFile<{
      reviewItems?: ReviewItem[];
      result?: { reviewItems?: ReviewItem[] };
    }>(reviewItemsPath);
    const reviewItems = reviewItemsPayload.reviewItems ?? reviewItemsPayload.result?.reviewItems ?? [];
    const resolutions = await readDataFile<ReviewResolution[]>(resolutionsPath);
    const resolutionLog = resolveReviewItems(reviewItems, resolutions);
    return createResponse(resolutionLog, {
      status: resolutionLog.overrides.length > 0 ? "warning" : "ok",
      confidence: 0.9,
      provenance: [toProvenance(reviewItemsPath, "review.resolve"), toProvenance(resolutionsPath, "review.resolve")],
    });
  },

  async "report.generate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleReportGenerate(args, context, scoreCompute);
  },

  async "gate.evaluate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleGateEvaluate(args, context, scoreCompute);
  },
};

export function listCommands(): string[] {
  return Object.keys(COMMANDS).sort();
}

export async function maybeWriteOutput(
  response: CommandResponse<unknown>,
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<void> {
  const output = typeof args.output === "string" ? new URL(args.output, `file://${context.cwd}/`).pathname : undefined;
  if (!output) {
    return;
  }
  await fs.writeFile(output, JSON.stringify(response, null, 2), "utf8");
}
