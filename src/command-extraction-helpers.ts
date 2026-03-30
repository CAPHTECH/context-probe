import { loadReviewLogIfRequested } from "./command-input-loaders.js";
import type { CommandArgs } from "./command-path-helpers.js";
import { getDocsRoot } from "./command-path-helpers.js";
import type { CommandContext, ExtractionBackend, ExtractionProviderName } from "./core/contracts.js";

function getExtractor(args: CommandArgs): ExtractionBackend {
  return args.extractor === "cli" ? "cli" : "heuristic";
}

function getProvider(args: CommandArgs): ExtractionProviderName | undefined {
  if (args.provider === "codex" || args.provider === "claude") {
    return args.provider;
  }
  return undefined;
}

function getPromptProfile(args: CommandArgs): string {
  return typeof args["prompt-profile"] === "string" ? args["prompt-profile"] : "default";
}

function getFallback(args: CommandArgs): "heuristic" | "none" {
  return args.fallback === "none" ? "none" : "heuristic";
}

export async function buildExtractionOptions(args: CommandArgs, context: CommandContext) {
  const provider = getProvider(args);
  const providerCommand = typeof args["provider-cmd"] === "string" ? args["provider-cmd"] : undefined;
  const reviewLog = await loadReviewLogIfRequested(args, context);
  return {
    root: getDocsRoot(args, context),
    cwd: context.cwd,
    extractor: getExtractor(args),
    ...(provider ? { provider } : {}),
    ...(providerCommand ? { providerCommand } : {}),
    promptProfile: getPromptProfile(args),
    fallback: getFallback(args),
    ...(reviewLog ? { reviewLog } : {}),
    applyReviewLog: args["apply-review-log"] === true,
  } as const;
}
