import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CODEX_STUB, prepareAiExtractionStub } from "./ai-extraction.shared.js";

export function registerAiExtractionGlossaryTests(): void {
  test("extracts glossary via codex cli stub", async () => {
    await prepareAiExtractionStub(CODEX_STUB);
    const response = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none",
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("ok");
    const result = response.result as {
      terms: Array<{ canonicalTerm: string; collision: boolean }>;
      metadata: { provider?: string; extractor: string };
    };
    expect(result.metadata.extractor).toBe("cli");
    expect(result.metadata.provider).toBe("codex");
    expect(result.terms[0]?.canonicalTerm).toBe("InvoiceContract");
    expect(result.terms[0]?.collision).toBe(true);
  });
}
