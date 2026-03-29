import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

const DOCS_ROOT = path.resolve("docs");

function listMarkdownFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(resolved);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [resolved] : [];
  });
  return files.sort();
}

function localizedBaseName(filePath: string): string {
  const relative = path.relative(DOCS_ROOT, filePath);
  return relative.replace(/\.ja\.md$/, ".md");
}

function markdownLinks(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const links = Array.from(content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), (match) => match[1]);
  return links.filter((link): link is string => typeof link === "string" && !/^(https?:|mailto:|#)/.test(link));
}

describe("document extraction", () => {
  test("extracts glossary and rules from docs", async () => {
    const glossary = await COMMANDS["doc.extract_glossary"]!(
      {
        "docs-root": "docs",
      },
      { cwd: process.cwd() },
    );
    const rules = await COMMANDS["doc.extract_rules"]!(
      {
        "docs-root": "docs",
      },
      { cwd: process.cwd() },
    );

    expect((glossary.result as { terms: unknown[] }).terms.length).toBeGreaterThan(0);
    expect((rules.result as { rules: unknown[] }).rules.length).toBeGreaterThan(0);
  });
});

describe("documentation structure", () => {
  test("keeps English and Japanese markdown structures mirrored", () => {
    const files = listMarkdownFiles(DOCS_ROOT);
    const english = files.filter((file) => !file.endsWith(".ja.md")).map(localizedBaseName);
    const japanese = files.filter((file) => file.endsWith(".ja.md")).map(localizedBaseName);

    expect(english).toEqual(japanese);
  });

  test("keeps markdown links inside docs resolvable", () => {
    const files = listMarkdownFiles(DOCS_ROOT);

    for (const filePath of files) {
      for (const link of markdownLinks(filePath)) {
        const [withoutFragment = ""] = link.split("#", 1);
        if (withoutFragment.length === 0) {
          continue;
        }

        const targetPath = path.resolve(path.dirname(filePath), withoutFragment);
        expect(fs.existsSync(targetPath), `${path.relative(process.cwd(), filePath)} -> ${link}`).toBe(true);
      }
    }
  });
});
