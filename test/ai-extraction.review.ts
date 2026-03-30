import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CODEX_STUB, prepareAiExtractionStub, writeTempJson } from "./ai-extraction.shared.js";

export function registerAiExtractionReviewTests(): void {
  test("applies review log to extracted glossary terms", async () => {
    await prepareAiExtractionStub(CODEX_STUB);
    const glossaryResponse = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none",
      },
      { cwd: process.cwd() },
    );
    const reviewItemsResponse = await COMMANDS["review.list_unknowns"]!(
      {
        input: await writeTempJson(glossaryResponse),
      },
      { cwd: process.cwd() },
    );
    const reviewItems = (reviewItemsResponse.result as { reviewItems: Array<{ reviewItemId: string; reason: string }> })
      .reviewItems;
    const collisionItem = reviewItems.find((item) => item.reason === "collision");
    expect(collisionItem).toBeTruthy();

    const resolutionLogPath = await writeTempJson([
      {
        reviewItemId: collisionItem?.reviewItemId,
        status: "resolved",
        decision: {
          patch: {
            collision: false,
            aliases: ["Invoice"],
          },
        },
      },
    ]);
    const reviewItemsPath = await writeTempJson(reviewItemsResponse.result);
    const resolutionResponse = await COMMANDS["review.resolve"]!(
      {
        "review-items": reviewItemsPath,
        resolutions: resolutionLogPath,
      },
      { cwd: process.cwd() },
    );
    const reviewLogPath = await writeTempJson(resolutionResponse.result);

    const resolvedGlossaryResponse = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none",
        "review-log": reviewLogPath,
        "apply-review-log": true,
      },
      { cwd: process.cwd() },
    );

    const resolvedTerms = (
      resolvedGlossaryResponse.result as {
        terms: Array<{ collision: boolean; aliases: string[] }>;
      }
    ).terms;
    expect(resolvedTerms[0]?.collision).toBe(false);
    expect(resolvedTerms[0]?.aliases).toEqual(["Invoice"]);
  });
}
