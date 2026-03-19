import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

const CODEX_STUB = path.resolve("test/fixtures/stubs/codex-stub.mjs");
const CLAUDE_STUB = path.resolve("test/fixtures/stubs/claude-stub.mjs");

describe("AI-backed extraction", () => {
  afterAll(async () => {
    await chmod(CODEX_STUB, 0o755);
    await chmod(CLAUDE_STUB, 0o755);
  });

  test("extracts glossary via codex cli stub", async () => {
    await chmod(CODEX_STUB, 0o755);
    const response = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
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

  test("extracts rules via claude cli stub", async () => {
    await chmod(CLAUDE_STUB, 0o755);
    const response = await COMMANDS["doc.extract_rules"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "claude",
        "provider-cmd": CLAUDE_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
    );

    const result = response.result as {
      rules: Array<{ statement: string }>;
      metadata: { provider?: string };
    };
    expect(result.metadata.provider).toBe("claude");
    expect(result.rules[0]?.statement).toContain("注文確定後");
  });

  test("applies review log to extracted glossary terms", async () => {
    await chmod(CODEX_STUB, 0o755);
    const glossaryResponse = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
    );
    const reviewItemsResponse = await COMMANDS["review.list_unknowns"]!(
      {
        input: await writeTempJson(glossaryResponse)
      },
      { cwd: process.cwd() }
    );
    const reviewItems = (reviewItemsResponse.result as { reviewItems: Array<{ reviewItemId: string; reason: string }> }).reviewItems;
    const collisionItem = reviewItems.find((item) => item.reason === "collision");
    expect(collisionItem).toBeTruthy();

    const resolutionLogPath = await writeTempJson([
      {
        reviewItemId: collisionItem?.reviewItemId,
        status: "resolved",
        decision: {
          patch: {
            collision: false,
            aliases: ["Invoice"]
          }
        }
      }
    ]);
    const reviewItemsPath = await writeTempJson(reviewItemsResponse.result);
    const resolutionResponse = await COMMANDS["review.resolve"]!(
      {
        "review-items": reviewItemsPath,
        resolutions: resolutionLogPath
      },
      { cwd: process.cwd() }
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
        "apply-review-log": true
      },
      { cwd: process.cwd() }
    );

    const resolvedTerms = (resolvedGlossaryResponse.result as {
      terms: Array<{ collision: boolean; aliases: string[] }>;
    }).terms;
    expect(resolvedTerms[0]?.collision).toBe(false);
    expect(resolvedTerms[0]?.aliases).toEqual(["Invoice"]);
  });

  test("builds trace links from extracted terms", async () => {
    await chmod(CODEX_STUB, 0o755);
    const response = await COMMANDS["trace.link_terms"]!(
      {
        "docs-root": "docs",
        repo: "fixtures/domain-design/sample-repo",
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
    );

    const result = response.result as {
      links: Array<{ canonicalTerm: string; coverage: { codeHits: number } }>;
    };
    expect(result.links[0]?.canonicalTerm).toBe("InvoiceContract");
    expect(result.links[0]?.coverage.codeHits).toBeGreaterThan(0);
  });
});

async function writeTempJson(payload: unknown): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-review-"));
  const filePath = path.join(tempDir, "payload.json");
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
