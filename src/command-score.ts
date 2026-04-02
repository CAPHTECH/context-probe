import { buildArchitectureScoreOptions } from "./command-architecture-inputs.js";
import type { CommandArgs } from "./command-helpers.js";
import {
  buildExtractionOptions,
  getDocsRoot,
  getProfile,
  getRootPath,
  requireDomainModel,
  requireShadowRolloutRegistry,
} from "./command-helpers.js";
import { computeAiChangeReviewCommandResponse, isAiChangeReviewDomain } from "./core/ai-change-review-registry.js";
import type { CommandContext, CommandResponse } from "./core/contracts.js";
import { mergeRuntimeSummary } from "./core/measurement-metadata.js";
import { loadPolicyConfig } from "./core/policy.js";
import { computeArchitectureScores, computeDomainDesignScores } from "./core/scoring.js";
import {
  evaluateShadowRolloutGate,
  loadShadowRolloutRegistry,
  registryToGateObservations,
} from "./core/shadow-rollout.js";

export async function handleScoreCompute(
  args: CommandArgs,
  context: CommandContext,
): Promise<CommandResponse<unknown>> {
  const startedAt = Date.now();
  const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
  const domain = typeof args.domain === "string" ? args.domain : "domain_design";
  const pilotPersistence = args["pilot-persistence"] === true;
  const rolloutCategory = typeof args["rollout-category"] === "string" ? args["rollout-category"] : undefined;
  if (rolloutCategory && !pilotPersistence) {
    throw new Error("`--rollout-category` requires `--pilot-persistence`");
  }

  if (domain === "architecture_design") {
    const scoreResponse = await computeArchitectureScores(
      await buildArchitectureScoreOptions(args, context, policyConfig),
    );
    return {
      ...scoreResponse,
      meta: {
        ...(scoreResponse.meta ?? {}),
        runtime: mergeRuntimeSummary(scoreResponse.meta?.runtime, {
          totalMs: Date.now() - startedAt,
          stages: {
            inputLoadMs: Date.now() - startedAt - (scoreResponse.meta?.runtime?.totalMs ?? 0),
          },
        }),
      },
    };
  }

  if (isAiChangeReviewDomain(domain)) {
    const scoreResponse = await computeAiChangeReviewCommandResponse(args, context, policyConfig);
    return {
      ...scoreResponse,
      meta: {
        ...(scoreResponse.meta ?? {}),
        runtime: mergeRuntimeSummary(scoreResponse.meta?.runtime, {
          totalMs: Date.now() - startedAt,
          stages: {
            inputLoadMs: Date.now() - startedAt - (scoreResponse.meta?.runtime?.totalMs ?? 0),
          },
        }),
      },
    };
  }

  const model = await requireDomainModel(args, context);
  const docsRoot = typeof args["docs-root"] === "string" ? getDocsRoot(args, context) : undefined;
  const extractionOptions = docsRoot ? await buildExtractionOptions(args, context) : undefined;
  let pilotGateEvaluation: ReturnType<typeof evaluateShadowRolloutGate> | undefined;

  if (pilotPersistence) {
    if (!rolloutCategory) {
      throw new Error("`--rollout-category` is required when `--pilot-persistence` is enabled");
    }
    const { registry, registryPath } = await requireShadowRolloutRegistry(args, context, loadShadowRolloutRegistry);
    pilotGateEvaluation = evaluateShadowRolloutGate(registryToGateObservations(registry, registryPath));
  }

  const scoreResponse = await computeDomainDesignScores({
    repoPath: getRootPath(args, context),
    model,
    policyConfig,
    profileName: getProfile(args),
    ...(context.reportProgress ? { progressReporter: context.reportProgress } : {}),
    shadowPersistence: args["shadow-persistence"] === true || pilotPersistence,
    ...(pilotPersistence && rolloutCategory ? { pilotPersistenceCategory: rolloutCategory } : {}),
    ...(pilotGateEvaluation ? { pilotGateEvaluation } : {}),
    ...(docsRoot ? { docsRoot } : {}),
    ...(extractionOptions
      ? {
          extraction: {
            extractor: extractionOptions.extractor,
            ...(extractionOptions.provider ? { provider: extractionOptions.provider } : {}),
            ...(extractionOptions.providerCommand ? { providerCommand: extractionOptions.providerCommand } : {}),
            promptProfile: extractionOptions.promptProfile,
            fallback: extractionOptions.fallback,
            ...(extractionOptions.reviewLog ? { reviewLog: extractionOptions.reviewLog } : {}),
            applyReviewLog: extractionOptions.applyReviewLog,
          },
        }
      : {}),
  });
  return {
    ...scoreResponse,
    meta: {
      ...(scoreResponse.meta ?? {}),
      runtime: mergeRuntimeSummary(scoreResponse.meta?.runtime, {
        totalMs: Date.now() - startedAt,
        stages: {
          inputLoadMs: Date.now() - startedAt - (scoreResponse.meta?.runtime?.totalMs ?? 0),
        },
      }),
    },
  };
}
