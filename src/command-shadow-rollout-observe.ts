import { parseSafeTieTolerance, requireRegisteredCommand } from "./command-shadow-rollout-shared.js";
import type { CommandLookup } from "./command-types.js";
import type {
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutObservation,
} from "./core/contracts.js";
import { createResponse } from "./core/response.js";

export async function handleObserveShadowRolloutCommand(
  commandLookup: CommandLookup,
  args: Record<string, string | boolean>,
  context: { cwd: string },
): Promise<CommandResponse<DomainDesignShadowRolloutObservation>> {
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

  const safeTieTolerance = parseSafeTieTolerance(
    typeof args["tie-tolerance"] === "string" ? args["tie-tolerance"] : undefined,
  );
  const baselineElsValue = scoreResponse.result.pilot?.baselineElsValue ?? elsMetric.value;
  const policyDelta = scoreResponse.result.shadow.localityModels.persistenceCandidate.localityScore - baselineElsValue;
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
}
