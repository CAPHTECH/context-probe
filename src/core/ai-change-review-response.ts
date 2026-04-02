import type { AiChangeReviewContext } from "./ai-change-review-context.js";
import type {
  AiChangeReviewDiffSummary,
  AiChangeReviewScoreResult,
  AiChangeReviewTarget,
  CommandResponse,
  Evidence,
} from "./contracts.js";
import { isSourceFile } from "./io.js";
import { confidenceFromSignals, createResponse, toProvenance } from "./response.js";
import { dedupeEvidence } from "./scoring-shared.js";

export function buildAiChangeReviewScoreResponse(input: {
  context: AiChangeReviewContext;
  reviewTargets: AiChangeReviewTarget[];
  evidence: Evidence[];
  diagnostics: string[];
  confidenceSignals: number[];
  progress: CommandResponse<unknown>["progress"];
  startedAt: number;
}): CommandResponse<AiChangeReviewScoreResult> {
  const diffSummary: AiChangeReviewDiffSummary = {
    baseBranch: input.context.baseBranch,
    headBranch: input.context.headBranch,
    mergeBase: input.context.mergeBase,
    changedFileCount: input.context.files.length,
    changedHunkCount: input.context.files.reduce((sum, file) => sum + file.hunks.length, 0),
    analyzedFileCount: input.context.files.filter((file) => isSourceFile(file.path)).length,
  };
  const confidenceSignals = [...input.confidenceSignals];
  if (input.context.files.length === 0) {
    confidenceSignals.push(1);
  }

  return createResponse(
    {
      domainId: "ai_change_review",
      metrics: [],
      diffSummary,
      reviewTargets: input.reviewTargets,
    },
    {
      status: input.reviewTargets.length > 0 || input.diagnostics.length > 0 ? "warning" : "ok",
      evidence: dedupeEvidence(input.evidence),
      confidence: confidenceFromSignals(confidenceSignals.length > 0 ? confidenceSignals : [0.92]),
      unknowns: [],
      diagnostics: input.diagnostics,
      progress: input.progress,
      provenance: [
        toProvenance(input.context.repoPath, "ai_change_review"),
        toProvenance(input.context.repoPath, `base=${input.context.baseBranch}`),
        toProvenance(input.context.repoPath, `head=${input.context.headBranch}`),
        toProvenance(input.context.repoPath, `merge_base=${input.context.mergeBase}`),
      ],
      meta: {
        runtime: {
          totalMs: Date.now() - input.startedAt,
          stages: {
            historyMs: input.context.historyMs,
            analysisMs: Date.now() - input.startedAt - input.context.historyMs,
          },
        },
      },
    },
  );
}
