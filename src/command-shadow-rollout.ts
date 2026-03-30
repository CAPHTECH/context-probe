import path from "node:path";

import {
  parseTieTolerance,
  requireShadowRolloutBatchSpec,
  requireShadowRolloutRegistry,
  resolveSpecRelativePath,
} from "./command-helpers.js";
import type { CommandHandler, CommandLookup } from "./command-types.js";
import type {
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutBatchResult,
  DomainDesignShadowRolloutGateResult,
  DomainDesignShadowRolloutObservation,
} from "./core/contracts.js";
import { confidenceFromSignals, createResponse, mergeStatus, toProvenance } from "./core/response.js";
import {
  batchToGateObservations,
  evaluateShadowRolloutGate,
  inferShadowRolloutModelSource,
  loadShadowRolloutRegistry,
  registryToGateObservations,
  summarizeShadowRolloutBatchObservations,
} from "./core/shadow-rollout.js";

function requireRegisteredCommand(commandLookup: CommandLookup, name: string): CommandHandler {
  const command = commandLookup(name);
  if (!command) {
    throw new Error(`${name} is not registered`);
  }
  return command;
}

export function createShadowRolloutCommands(commandLookup: CommandLookup): Record<string, CommandHandler> {
  return {
    async "score.observe_shadow_rollout"(args, context) {
      const scoreCompute = requireRegisteredCommand(commandLookup, "score.compute");

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
        Math.abs(policyDelta) <= safeTieTolerance
          ? "aligned"
          : policyDelta > 0
            ? "candidate_higher"
            : "candidate_lower";

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
      const observeShadowRollout = requireRegisteredCommand(commandLookup, "score.observe_shadow_rollout");
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
      const observeShadowRolloutBatch = requireRegisteredCommand(commandLookup, "score.observe_shadow_rollout_batch");

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
  };
}
