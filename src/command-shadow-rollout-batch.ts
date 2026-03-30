import path from "node:path";
import { requireShadowRolloutBatchSpec, resolveSpecRelativePath } from "./command-helpers.js";
import { requireRegisteredCommand, resolveTieTolerance } from "./command-shadow-rollout-shared.js";
import type { CommandLookup } from "./command-types.js";
import type {
  CommandResponse,
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutBatchResult,
  DomainDesignShadowRolloutObservation,
} from "./core/contracts.js";
import { confidenceFromSignals, createResponse, mergeStatus, toProvenance } from "./core/response.js";
import { inferShadowRolloutModelSource, summarizeShadowRolloutBatchObservations } from "./core/shadow-rollout.js";

export async function handleObserveShadowRolloutBatchCommand(
  commandLookup: CommandLookup,
  args: Record<string, string | boolean>,
  context: { cwd: string },
): Promise<CommandResponse<DomainDesignShadowRolloutBatchResult>> {
  const observeShadowRollout = requireRegisteredCommand(commandLookup, "score.observe_shadow_rollout");
  const { spec, specPath } = await requireShadowRolloutBatchSpec(args, context);
  const specDirectory = path.dirname(specPath);
  const argPolicyPath =
    typeof args.policy === "string" ? new URL(args.policy, `file://${context.cwd}/`).pathname : undefined;
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

    const tieTolerance = resolveTieTolerance(
      entry.tieTolerance,
      spec.tieTolerance,
      typeof args["tie-tolerance"] === "string" ? args["tie-tolerance"] : undefined,
    );

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
}
