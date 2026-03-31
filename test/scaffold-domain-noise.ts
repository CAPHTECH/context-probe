import { expect, test } from "vitest";

import type {
  DomainModel,
  GlossaryTerm,
  InvariantCandidate,
  RuleCandidate,
  TermTraceLink,
  TraceLinkOccurrence,
} from "../src/core/contracts.js";
import { createInferredAggregateCandidates } from "../src/core/scaffold-domain-aggregates-inferred.js";
import { isNoisyAggregateLabel } from "../src/core/scaffold-domain-aggregates-shared.js";
import type { ContextCandidateEntry } from "../src/core/scaffold-domain-contexts.js";

function createTerm(termId: string, canonicalTerm: string, fragmentId = "FRG-1"): GlossaryTerm {
  return {
    termId,
    canonicalTerm,
    aliases: [],
    count: 1,
    collision: false,
    confidence: 0.8,
    evidence: [],
    unknowns: [],
    fragmentIds: [fragmentId],
  };
}

function createLink(termId: string, canonicalTerm: string): TermTraceLink {
  return {
    termId,
    canonicalTerm,
    occurrences: [{ kind: "code", path: "src/domain/fact-ledger.ts", matchCount: 2 }],
    coverage: { documentHits: 1, codeHits: 2 },
    confidence: 0.8,
  };
}

export function registerScaffoldDomainNoiseTests(): void {
  test("aggregate scaffold filters environment and diff-like noise generically", () => {
    expect(isNoisyAggregateLabel("APP_PORT")).toBe(true);
    expect(isNoisyAggregateLabel("MODIFIED")).toBe(true);
    expect(isNoisyAggregateLabel("git diff")).toBe(true);
    expect(isNoisyAggregateLabel("Fact Ledger")).toBe(false);
  });

  test("inferred aggregate candidates skip noisy localized terms", () => {
    const model: DomainModel = {
      version: "1.0",
      contexts: [{ name: "KnowledgeSubstrate", pathGlobs: ["src/domain/**"] }],
    };
    const contextCandidates: ContextCandidateEntry[] = [
      {
        group: {
          key: "src/domain",
          basePath: "src/domain",
          sourceRoot: "src",
          segment: "domain",
          pathGlobs: ["src/domain/**"],
          files: ["src/domain/fact-ledger.ts"],
        },
        candidate: {
          definition: model.contexts[0]!,
          confidence: 0.9,
          evidence: [],
          unknowns: [],
        },
      },
    ];
    const rules: RuleCandidate[] = [
      {
        ruleId: "RULE-1",
        type: "heuristic",
        statement: "Fact Ledger must remain append-only.",
        confidence: 0.8,
        evidence: [],
        unknowns: [],
        fragmentIds: ["FRG-1"],
        relatedTerms: ["Fact Ledger"],
      },
    ];
    const invariants: InvariantCandidate[] = [];
    const terms = [
      createTerm("TERM-1", "Fact Ledger"),
      createTerm("TERM-2", "APP_PORT"),
      createTerm("TERM-3", "MODIFIED"),
    ];
    const termLinks = [
      createLink("TERM-1", "Fact Ledger"),
      createLink("TERM-2", "APP_PORT"),
      createLink("TERM-3", "MODIFIED"),
    ];

    const candidates = createInferredAggregateCandidates(contextCandidates, {
      glossary: {
        terms,
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      rules: {
        rules,
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      invariants: {
        invariants,
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      termLinks,
    });

    expect(candidates.map((candidate) => candidate.definition.name)).toEqual(["FactLedger"]);
  });

  test("inferred aggregate candidates skip technical contexts without explicit rule support", () => {
    const model: DomainModel = {
      version: "1.0",
      contexts: [
        { name: "RuntimeProfiles", pathGlobs: ["src/runtime/**"] },
        { name: "Tests", pathGlobs: ["tests/**"] },
        { name: "UseCases", pathGlobs: ["src/usecases/**"] },
      ],
    };
    const contextCandidates: ContextCandidateEntry[] = model.contexts.map((context) => ({
      group: {
        key: context.name,
        basePath: context.pathGlobs[0]?.replace("/**", "") ?? "",
        sourceRoot: "src",
        segment: context.name,
        pathGlobs: context.pathGlobs,
        files: [context.pathGlobs[0]?.replace("/**", "/example.ts") ?? "example.ts"],
      },
      candidate: {
        definition: context,
        confidence: 0.9,
        evidence: [],
        unknowns: [],
      },
    }));
    const terms = [
      createTerm("TERM-1", "Snapshot", "FRG-1"),
      createTerm("TERM-2", "Captures", "FRG-2"),
      createTerm("TERM-3", "MissingTaskPatternCoverage", "FRG-3"),
    ];
    const termLinks: TermTraceLink[] = terms.map((term, index) => ({
      termId: term.termId,
      canonicalTerm: term.canonicalTerm,
      occurrences: [
        {
          kind: "code" as const,
          path: index === 0 ? "src/runtime/snapshot.ts" : "tests/example.spec.ts",
          matchCount: 1,
        } satisfies TraceLinkOccurrence,
      ] as TraceLinkOccurrence[],
      coverage: { documentHits: 1, codeHits: index === 2 ? 1 : 2 },
      confidence: 0.8,
    }));

    const candidates = createInferredAggregateCandidates(contextCandidates, {
      glossary: {
        terms,
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      rules: {
        rules: [],
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      invariants: {
        invariants: [],
        confidence: 0.8,
        unknowns: [],
        diagnostics: [],
        fragments: [],
        metadata: { extractor: "heuristic", promptProfile: "default", fallback: "heuristic" },
      },
      termLinks,
    });

    expect(candidates).toEqual([]);
  });
}
