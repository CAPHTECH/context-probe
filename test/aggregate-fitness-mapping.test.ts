import { expect, test } from "vitest";
import { collectAggregateTargets } from "../src/core/aggregate-fitness-shared.js";
import { collectStatementContexts } from "../src/core/boundary-fitness.js";
import type { AggregateDefinition, DomainModel, InvariantCandidate } from "../src/core/contracts.js";

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
