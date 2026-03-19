import { existsSync } from "node:fs";
import { access, chmod, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

const VALIDATION_ROOT = path.resolve("fixtures/validation/extraction");
const PROVIDER_STUBS = {
  codex: path.resolve("test/fixtures/stubs/codex-stub.mjs"),
  claude: path.resolve("test/fixtures/stubs/claude-stub.mjs")
} as const;

interface ValidationExpectation {
  extractor: {
    backend: "heuristic" | "cli";
    provider?: keyof typeof PROVIDER_STUBS;
  };
  glossary?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  rules?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  invariants?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  trace?: {
    mustLinkToCode?: string[];
    mustStayDocumentOnly?: string[];
  };
  review?: {
    sourceCommand: "doc.extract_glossary" | "doc.extract_rules" | "doc.extract_invariants";
    mustIncludeReasons: string[];
    maxItems: number;
  };
}

const CASES = await loadValidationCases();

describe("extraction validation harness", () => {
  beforeAll(async () => {
    await Promise.all(Object.values(PROVIDER_STUBS).map(async (stub) => chmod(stub, 0o755)));
  });

  afterAll(async () => {
    await Promise.all(Object.values(PROVIDER_STUBS).map(async (stub) => access(stub)));
  });

  for (const validationCase of CASES) {
    test(validationCase.name, async () => {
      const baseArgs = buildBaseArgs(validationCase.path, validationCase.expectation);

      if (validationCase.expectation.glossary) {
        const response = await COMMANDS["doc.extract_glossary"]!(baseArgs, { cwd: process.cwd() });
        const terms = (response.result as { terms: Array<{ canonicalTerm: string }> }).terms.map((term) => term.canonicalTerm);
        expect(terms).toEqual(expect.arrayContaining(validationCase.expectation.glossary.mustInclude));
        validationCase.expectation.glossary.mustExclude.forEach((term) => {
          expect(terms).not.toContain(term);
        });
      }

      if (validationCase.expectation.rules) {
        const response = await COMMANDS["doc.extract_rules"]!(baseArgs, { cwd: process.cwd() });
        const statements = (response.result as { rules: Array<{ statement: string }> }).rules.map((rule) =>
          normalizeText(rule.statement)
        );
        validationCase.expectation.rules.mustInclude.forEach((expected) => {
          expect(statements.some((statement) => statement.includes(normalizeText(expected)))).toBe(true);
        });
        validationCase.expectation.rules.mustExclude.forEach((unexpected) => {
          expect(statements.some((statement) => statement.includes(normalizeText(unexpected)))).toBe(false);
        });
      }

      if (validationCase.expectation.invariants) {
        const response = await COMMANDS["doc.extract_invariants"]!(baseArgs, { cwd: process.cwd() });
        const statements = (response.result as { invariants: Array<{ statement: string }> }).invariants.map(
          (invariant) => normalizeText(invariant.statement)
        );
        validationCase.expectation.invariants.mustInclude.forEach((expected) => {
          expect(statements.some((statement) => statement.includes(normalizeText(expected)))).toBe(true);
        });
        validationCase.expectation.invariants.mustExclude.forEach((unexpected) => {
          expect(statements.some((statement) => statement.includes(normalizeText(unexpected)))).toBe(false);
        });
      }

      if (validationCase.expectation.trace) {
        const response = await COMMANDS["trace.link_terms"]!(baseArgs, { cwd: process.cwd() });
        const links = (response.result as {
          links: Array<{ canonicalTerm: string; coverage: { documentHits: number; codeHits: number } }>;
        }).links;
        validationCase.expectation.trace.mustLinkToCode?.forEach((term) => {
          const link = links.find((entry) => entry.canonicalTerm === term);
          expect(link?.coverage.codeHits ?? 0).toBeGreaterThan(0);
        });
        validationCase.expectation.trace.mustStayDocumentOnly?.forEach((term) => {
          const link = links.find((entry) => entry.canonicalTerm === term);
          expect(link?.coverage.documentHits ?? 0).toBeGreaterThan(0);
          expect(link?.coverage.codeHits ?? 0).toBe(0);
        });
      }

      if (validationCase.expectation.review) {
        const reviewResponse = await COMMANDS["review.list_unknowns"]!(
          {
            ...baseArgs,
            "source-command": validationCase.expectation.review.sourceCommand
          },
          { cwd: process.cwd() }
        );
        const reviewItems = (reviewResponse.result as { reviewItems: Array<{ reason: string }> }).reviewItems;
        const reasons = reviewItems.map((item) => item.reason);
        expect(reviewItems.length).toBeLessThanOrEqual(validationCase.expectation.review.maxItems);
        expect(reasons).toEqual(expect.arrayContaining(validationCase.expectation.review.mustIncludeReasons));
      }
    });
  }
});

async function loadValidationCases() {
  const entries = await readdir(VALIDATION_ROOT, { withFileTypes: true });
  const cases = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const casePath = path.join(VALIDATION_ROOT, entry.name);
        const expectation = JSON.parse(
          await readFile(path.join(casePath, "expectations.json"), "utf8")
        ) as ValidationExpectation;
        return {
          name: entry.name,
          path: casePath,
          expectation
        };
      })
  );
  return cases.sort((left, right) => left.name.localeCompare(right.name));
}

function buildBaseArgs(casePath: string, expectation: ValidationExpectation): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {
    "docs-root": casePath,
    extractor: expectation.extractor.backend
  };
  const repoPath = path.join(casePath, "repo");
  if (expectation.trace || hasRepoDirectory(casePath)) {
    args.repo = repoPath;
  }
  if (expectation.extractor.backend === "cli" && expectation.extractor.provider) {
    args.provider = expectation.extractor.provider;
    args["provider-cmd"] = PROVIDER_STUBS[expectation.extractor.provider];
    args.fallback = "none";
  }
  return args;
}

function hasRepoDirectory(casePath: string): boolean {
  return existsSync(path.join(casePath, "repo"));
}

function normalizeText(input: string): string {
  return input.replace(/`/g, "").replace(/\s+/g, " ").trim();
}
