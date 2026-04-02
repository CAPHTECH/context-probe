import type { CommandArgs } from "../command-helpers.js";
import { getProfile, getRootPath } from "../command-helpers.js";
import type { CommandContext, CommandResponse, DomainPack, PolicyConfig } from "./contracts.js";
import { computeAiChangeReviewScores } from "./scoring.js";

export const AI_CHANGE_REVIEW_DOMAIN_ID = "ai_change_review" as const;

const AI_CHANGE_REVIEW_COMMANDS = ["score.compute", "review.list_unknowns"] as const;
const AI_CHANGE_REVIEW_REVIEW_RULES = ["confidence < 0.75", "unknowns_count > 0"] as const;

export const AI_CHANGE_REVIEW_PACK: DomainPack = {
  id: AI_CHANGE_REVIEW_DOMAIN_ID,
  version: "0.1",
  commands: [...AI_CHANGE_REVIEW_COMMANDS],
  metrics: [],
  reviewRules: [...AI_CHANGE_REVIEW_REVIEW_RULES],
};

export function isAiChangeReviewDomain(domain: string | undefined): domain is typeof AI_CHANGE_REVIEW_DOMAIN_ID {
  return domain === AI_CHANGE_REVIEW_DOMAIN_ID;
}

function getAiChangeReviewBranchRequirementMessage(): string {
  return "`--base-branch` and `--head-branch` are required for `--domain ai_change_review`";
}

export function getAiChangeReviewUnsupportedCommandMessage(commandName: "report.generate" | "gate.evaluate"): string {
  if (commandName === "report.generate") {
    return "`report.generate` does not support `ai_change_review` yet. Use `score.compute` or `review.list_unknowns`.";
  }
  return "`gate.evaluate` does not support `ai_change_review` yet because this domain is advisory-only.";
}

function requireAiChangeReviewBranches(args: CommandArgs): { baseBranch: string; headBranch: string } {
  const baseBranch = typeof args["base-branch"] === "string" ? args["base-branch"] : undefined;
  const headBranch = typeof args["head-branch"] === "string" ? args["head-branch"] : undefined;
  if (!baseBranch || !headBranch) {
    throw new Error(getAiChangeReviewBranchRequirementMessage());
  }
  return { baseBranch, headBranch };
}

export async function computeAiChangeReviewCommandResponse(
  args: CommandArgs,
  context: CommandContext,
  policyConfig: PolicyConfig,
): Promise<CommandResponse<unknown>> {
  const { baseBranch, headBranch } = requireAiChangeReviewBranches(args);
  return computeAiChangeReviewScores({
    repoPath: getRootPath(args, context),
    baseBranch,
    headBranch,
    policyConfig,
    profileName: getProfile(args),
    ...(context.reportProgress ? { progressReporter: context.reportProgress } : {}),
  });
}
