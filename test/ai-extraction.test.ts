import { afterAll, describe } from "vitest";

import { registerAiExtractionGlossaryTests } from "./ai-extraction.glossary.js";
import { registerAiExtractionReviewTests } from "./ai-extraction.review.js";
import { registerAiExtractionRulesTests } from "./ai-extraction.rules.js";
import { restoreAiExtractionStubs } from "./ai-extraction.shared.js";
import { registerAiExtractionTraceTests } from "./ai-extraction.trace.js";

describe("AI-backed extraction", () => {
  afterAll(async () => {
    await restoreAiExtractionStubs();
  });
  registerAiExtractionGlossaryTests();
  registerAiExtractionRulesTests();
  registerAiExtractionReviewTests();
  registerAiExtractionTraceTests();
});
