import { promises as fs } from "node:fs";
import { createArchitectureCommands } from "./command-architecture.js";
import { createDomainCommands } from "./command-domain.js";
import { createHistoryCommands } from "./command-history.js";
import { handleScoreCompute } from "./command-score.js";
import { handleGateEvaluate, handleReportGenerate, handleReviewListUnknowns } from "./command-score-driven.js";
import { createShadowRolloutCommands } from "./command-shadow-rollout.js";
import type { CommandHandler } from "./command-types.js";
import type { CommandContext, CommandResponse, ReviewItem, ReviewResolution } from "./core/contracts.js";
import { readDataFile } from "./core/io.js";
import { createResponse, toProvenance } from "./core/response.js";
import { resolveReviewItems } from "./core/review.js";

export type { CommandHandler } from "./command-types.js";

export const COMMANDS: Record<string, CommandHandler> = {
  ...createDomainCommands(),
  ...createHistoryCommands(),
  ...createArchitectureCommands(),

  "score.compute": handleScoreCompute,

  async "review.list_unknowns"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleReviewListUnknowns(args, context, scoreCompute, COMMANDS);
  },

  async "review.resolve"(args, context) {
    const reviewItemsPath =
      typeof args["review-items"] === "string"
        ? new URL(args["review-items"], `file://${context.cwd}/`).pathname
        : undefined;
    const resolutionsPath =
      typeof args.resolutions === "string" ? new URL(args.resolutions, `file://${context.cwd}/`).pathname : undefined;
    if (!reviewItemsPath || !resolutionsPath) {
      throw new Error("`--review-items` and `--resolutions` are required");
    }
    const reviewItemsPayload = await readDataFile<{
      reviewItems?: ReviewItem[];
      result?: { reviewItems?: ReviewItem[] };
    }>(reviewItemsPath);
    const reviewItems = reviewItemsPayload.reviewItems ?? reviewItemsPayload.result?.reviewItems ?? [];
    const resolutions = await readDataFile<ReviewResolution[]>(resolutionsPath);
    const resolutionLog = resolveReviewItems(reviewItems, resolutions);
    return createResponse(resolutionLog, {
      status: resolutionLog.overrides.length > 0 ? "warning" : "ok",
      confidence: 0.9,
      provenance: [toProvenance(reviewItemsPath, "review.resolve"), toProvenance(resolutionsPath, "review.resolve")],
    });
  },

  async "report.generate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleReportGenerate(args, context, scoreCompute);
  },

  async "gate.evaluate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    return handleGateEvaluate(args, context, scoreCompute);
  },
  ...createShadowRolloutCommands((name) => COMMANDS[name]),
};

export function listCommands(): string[] {
  return Object.keys(COMMANDS).sort();
}

export async function maybeWriteOutput(
  response: CommandResponse<unknown>,
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<void> {
  const output = typeof args.output === "string" ? new URL(args.output, `file://${context.cwd}/`).pathname : undefined;
  if (!output) {
    return;
  }
  await fs.writeFile(output, JSON.stringify(response, null, 2), "utf8");
}
