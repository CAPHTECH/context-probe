import { expect, test } from "vitest";
import { computeAggregateFitness } from "../src/core/aggregate-fitness.js";
import { collectAggregateTargets } from "../src/core/aggregate-fitness-shared.js";
import { collectStatementContexts } from "../src/core/boundary-fitness.js";
import type { AggregateDefinition, DomainModel, InvariantCandidate } from "../src/core/contracts.js";
import { INVARIANT_ACCEPTANCE_AMBIGUITY } from "../src/core/document-extractor-text-review.js";

const MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    {
      name: "IdentityAndWorkspace",
      pathGlobs: ["src/workspace/**"],
    },
  ],
};

function createInvariant(statement: string, relatedTerms: string[] = []): InvariantCandidate {
  return {
    invariantId: "inv-1",
    type: "business-rule",
    statement,
    confidence: 0.9,
    evidence: [],
    unknowns: [],
    fragmentIds: [],
    relatedTerms,
  };
}

test("collectStatementContexts inherits contexts from glossary aliases without literal context mentions", () => {
  const contexts = collectStatementContexts(
    "A workspace member must accept the invite before joining.",
    [],
    new Map(),
    [
      {
        labels: ["workspace member", "member"],
        contexts: ["IdentityAndWorkspace"],
      },
    ],
    MODEL,
  );

  expect(contexts).toEqual(["IdentityAndWorkspace"]);
});

test("collectAggregateTargets maps decomposed aggregate names from natural-language invariants", () => {
  const aggregates: AggregateDefinition[] = [
    { name: "WorkspaceMembership", context: "IdentityAndWorkspace" },
    { name: "WorkspaceInvitation", context: "IdentityAndWorkspace" },
  ];

  const result = collectAggregateTargets(
    aggregates,
    ["IdentityAndWorkspace"],
    createInvariant("A workspace member must belong to exactly one workspace.", ["workspace member"]),
    [
      {
        labels: ["workspace member"],
        contexts: ["IdentityAndWorkspace"],
      },
    ],
  );

  expect(result.targets).toEqual(["IdentityAndWorkspace::WorkspaceMembership"]);
  expect(result.unknowns).toEqual([]);
});

test("collectAggregateTargets keeps the proxy when multiple aggregates remain ambiguous", () => {
  const aggregates: AggregateDefinition[] = [
    {
      name: "WorkspaceMembership",
      context: "IdentityAndWorkspace",
      aliases: ["workspace member"],
    },
    {
      name: "WorkspaceMemberProfile",
      context: "IdentityAndWorkspace",
      aliases: ["workspace member"],
    },
  ];

  const result = collectAggregateTargets(
    aggregates,
    ["IdentityAndWorkspace"],
    createInvariant("A workspace member must have a stable identifier.", ["workspace member"]),
    [
      {
        labels: ["workspace member"],
        contexts: ["IdentityAndWorkspace"],
      },
    ],
  );

  expect(result.targets).toEqual([]);
  expect(result.unknowns).toContain(
    'Invariant "inv-1" could not be mapped to a specific aggregate within IdentityAndWorkspace.',
  );
});

test("computeAggregateFitness ignores acceptance-condition-like invariants without domain anchors", () => {
  const result = computeAggregateFitness({
    model: {
      ...MODEL,
      aggregates: [{ name: "WorkspaceMembership", context: "IdentityAndWorkspace" }],
    },
    fragments: [],
    terms: [],
    links: [],
    invariants: [
      {
        ...createInvariant("[ ] AI による変更は直接反映される"),
        unknowns: [INVARIANT_ACCEPTANCE_AMBIGUITY],
      },
    ],
  });

  expect(result.unknowns).not.toContain(
    "Some invariants could not be mapped to explicit aggregates, so context proxy was retained.",
  );
  expect(result.unknowns).not.toContain("Some invariants could not be mapped to contexts, so SIC is approximate.");
  expect(result.diagnostics).toContain(
    "Ignored 1 acceptance-condition-like invariant(s) without aggregate anchors when computing AFS.",
  );
});

test("computeAggregateFitness ignores acceptance-condition-like invariants that only map through context hints", () => {
  const result = computeAggregateFitness({
    model: {
      version: "1.0",
      contexts: [
        {
          name: "AIChatAndAutomation",
          pathGlobs: ["src/ai/**"],
        },
      ],
      aggregates: [
        { name: "Conversation", context: "AIChatAndAutomation", aliases: ["Chat"] },
        { name: "Proposal", context: "AIChatAndAutomation", aliases: ["WorkflowUpdate"] },
      ],
    },
    fragments: [
      {
        fragmentId: "fragment-1",
        artifactId: "artifact-1",
        kind: "paragraph",
        text: "AIChatAndAutomation requirements",
        path: "docs/requirements.md",
        lineStart: 1,
        lineEnd: 1,
      },
    ],
    terms: [],
    links: [],
    invariants: [
      {
        ...createInvariant("[ ] AI による変更は直接反映される"),
        fragmentIds: ["fragment-1"],
        unknowns: [INVARIANT_ACCEPTANCE_AMBIGUITY],
      },
    ],
  });

  expect(result.unknowns).not.toContain(
    'Invariant "inv-1" could not be mapped to a specific aggregate within AIChatAndAutomation.',
  );
  expect(result.unknowns).not.toContain(
    "Some invariants could not be mapped to explicit aggregates, so context proxy was retained.",
  );
  expect(result.diagnostics).toContain(
    "Ignored 1 acceptance-condition-like invariant(s) without aggregate anchors when computing AFS.",
  );
});
