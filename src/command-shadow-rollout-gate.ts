import { requireShadowRolloutRegistry } from "./command-helpers.js";
import { requireRegisteredCommand } from "./command-shadow-rollout-shared.js";
import type { CommandLookup } from "./command-types.js";
import type {
  CommandResponse,
  DomainDesignShadowRolloutBatchResult,
  DomainDesignShadowRolloutGateResult,
} from "./core/contracts.js";
import { createResponse, toProvenance } from "./core/response.js";
import {
  batchToGateObservations,
  evaluateShadowRolloutGate,
  loadShadowRolloutRegistry,
  registryToGateObservations,
} from "./core/shadow-rollout.js";

export async function handleEvaluateShadowRolloutGateCommand(
  commandLookup: CommandLookup,
  args: Record<string, string | boolean>,
  context: { cwd: string },
): Promise<CommandResponse<DomainDesignShadowRolloutGateResult>> {
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
}
