import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

describe("document extraction", () => {
  test("extracts glossary and rules from docs", async () => {
    const glossary = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs"
      },
      { cwd: process.cwd() }
    );
    const rules = await COMMANDS["doc.extract_rules"]!(
      {
        "docs-root": "docs"
      },
      { cwd: process.cwd() }
    );

    expect((glossary.result as { terms: unknown[] }).terms.length).toBeGreaterThan(0);
    expect((rules.result as { rules: unknown[] }).rules.length).toBeGreaterThan(0);
  });
});
