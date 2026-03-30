import { handleObserveShadowRolloutBatchCommand } from "./command-shadow-rollout-batch.js";
import { handleEvaluateShadowRolloutGateCommand } from "./command-shadow-rollout-gate.js";
import { handleObserveShadowRolloutCommand } from "./command-shadow-rollout-observe.js";
import type { CommandHandler, CommandLookup } from "./command-types.js";

export function createShadowRolloutCommands(commandLookup: CommandLookup): Record<string, CommandHandler> {
  return {
    async "score.observe_shadow_rollout"(args, context) {
      return handleObserveShadowRolloutCommand(commandLookup, args, context);
    },
    async "score.observe_shadow_rollout_batch"(args, context) {
      return handleObserveShadowRolloutBatchCommand(commandLookup, args, context);
    },
    async "gate.evaluate_shadow_rollout"(args, context) {
      return handleEvaluateShadowRolloutGateCommand(commandLookup, args, context);
    },
  };
}
