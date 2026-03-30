import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CODEX_STUB, prepareAiExtractionStub } from "./ai-extraction.shared.js";

export function registerAiExtractionTraceTests(): void {
  test("builds trace links from extracted terms", async () => {
    await prepareAiExtractionStub(CODEX_STUB);
    const response = await COMMANDS["trace.link_terms"]!(
      {
        "docs-root": "docs",
        repo: "fixtures/domain-design/sample-repo",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none",
      },
      { cwd: process.cwd() },
    );

    const result = response.result as {
      links: Array<{ canonicalTerm: string; coverage: { codeHits: number } }>;
    };
    expect(result.links[0]?.canonicalTerm).toBe("InvoiceContract");
    expect(result.links[0]?.coverage.codeHits).toBeGreaterThan(0);
  });
}
