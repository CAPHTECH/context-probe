import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";

import {
  buildBaseArgs,
  ensureProviderStubsExecutable,
  loadValidationCases,
  verifyProviderStubsReadable,
} from "./extraction-validation.helpers.js";
import type { ValidationCase } from "./extraction-validation.types.js";

const CASES = await loadValidationCases();

describe("extraction validation harness", () => {
  beforeAll(async () => {
    await ensureProviderStubsExecutable();
  });

  afterAll(async () => {
    await verifyProviderStubsReadable();
  });

  for (const validationCase of CASES) {
    test(validationCase.name, async () => {
      await runValidationCase(validationCase);
    });
  }
});

async function runValidationCase(validationCase: ValidationCase) {
  const baseArgs = buildBaseArgs(validationCase.path, validationCase.expectation);

  if (validationCase.expectation.glossary) {
    const response = await COMMANDS["doc.extract_glossary"]!(baseArgs, { cwd: process.cwd() });
    const terms = (response.result as { terms: Array<{ canonicalTerm: string }> }).terms.map(
      (term) => term.canonicalTerm,
    );
    expect(terms).toEqual(expect.arrayContaining(validationCase.expectation.glossary.mustInclude));
    validationCase.expectation.glossary.mustExclude.forEach((term) => {
      expect(terms).not.toContain(term);
    });
  }

  if (validationCase.expectation.rules) {
    const response = await COMMANDS["doc.extract_rules"]!(baseArgs, { cwd: process.cwd() });
    const statements = (response.result as { rules: Array<{ statement: string }> }).rules.map((rule) =>
      normalizeText(rule.statement),
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
    const statements = (response.result as { invariants: Array<{ statement: string }> }).invariants.map((invariant) =>
      normalizeText(invariant.statement),
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
    const links = (
      response.result as {
        links: Array<{ canonicalTerm: string; coverage: { documentHits: number; codeHits: number } }>;
      }
    ).links;
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
        "source-command": validationCase.expectation.review.sourceCommand,
      },
      { cwd: process.cwd() },
    );
    const reviewItems = (reviewResponse.result as { reviewItems: Array<{ reason: string }> }).reviewItems;
    const reasons = reviewItems.map((item) => item.reason);
    expect(reviewItems.length).toBeLessThanOrEqual(validationCase.expectation.review.maxItems);
    expect(reasons).toEqual(expect.arrayContaining(validationCase.expectation.review.mustIncludeReasons));
  }
}

function normalizeText(input: string): string {
  return input.replace(/`/g, "").replace(/\s+/g, " ").trim();
}
