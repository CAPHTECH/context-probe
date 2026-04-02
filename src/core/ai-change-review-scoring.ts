import { createProgressTracker } from "./progress.js";

export async function computeAiChangeReviewScores(options: {
  repoPath: string;
  baseBranch: string;
  headBranch: string;
  policyConfig: import("./contracts.js").PolicyConfig;
  profileName: string;
  progressReporter?: (update: { phase: string; message: string }) => void;
}): Promise<import("./contracts.js").CommandResponse<import("./contracts.js").AiChangeReviewScoreResult>> {
  const startedAt = Date.now();
  const progress = createProgressTracker(options.progressReporter);
  const [{ collectAiChangeReviewContext }, { buildAiChangeReviewScoreResponse }, { scoreAiChangeReviewTargets }] =
    await Promise.all([
      import("./ai-change-review-context.js"),
      import("./ai-change-review-response.js"),
      import("./ai-change-review-targets.js"),
    ]);
  const context = await collectAiChangeReviewContext({
    repoPath: options.repoPath,
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    policyConfig: options.policyConfig,
    profileName: options.profileName,
    progress,
  });
  const scoredTargets = scoreAiChangeReviewTargets(context);
  return buildAiChangeReviewScoreResponse({
    context,
    reviewTargets: scoredTargets.reviewTargets,
    evidence: scoredTargets.evidence,
    diagnostics: scoredTargets.diagnostics,
    confidenceSignals: scoredTargets.confidenceSignals,
    progress: progress.progress,
    startedAt,
  });
}
