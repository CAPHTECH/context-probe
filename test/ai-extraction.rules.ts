import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CLAUDE_STUB, prepareAiExtractionStub } from "./ai-extraction.shared.js";

export function registerAiExtractionRulesTests(): void {
  test("extracts rules via claude cli stub", async () => {
    await prepareAiExtractionStub(CLAUDE_STUB);
    const response = await COMMANDS["doc.extract_rules"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "claude",
        "provider-cmd": CLAUDE_STUB,
        fallback: "none",
      },
      { cwd: process.cwd() },
    );

    const result = response.result as {
      rules: Array<{ statement: string }>;
      metadata: { provider?: string };
    };
    expect(result.metadata.provider).toBe("claude");
    expect(result.rules[0]?.statement).toContain("After order confirmation");
  });
}
