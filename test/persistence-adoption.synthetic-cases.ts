import type { CochangeCommit } from "../src/core/contracts.js";
import { compareEvolutionLocalityModels } from "../src/core/history.js";
import type { ComparisonEnvelope } from "./persistence-adoption.helpers.js";
import { SYNTHETIC_MODEL } from "./persistence-adoption.helpers.js";

function commit(hash: string, files: string[]): CochangeCommit {
  return {
    hash,
    subject: hash,
    files,
  };
}

export function stablePairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ab3", ["src/billing/c.ts", "src/fulfillment/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"]),
  ];
}

export function rotatingPairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ac1", ["src/billing/b.ts", "src/support/b.ts"]),
    commit("bc1", ["src/fulfillment/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"]),
  ];
}

export function partiallyConcentratedCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ac1", ["src/billing/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
    commit("s1", ["src/support/local.ts"]),
  ];
}

export function hubCommits(): CochangeCommit[] {
  return [
    commit("s1", ["src/support/ticket.ts"]),
    commit("s2", ["src/support/escalation.ts"]),
    commit("bs1", ["src/billing/a.ts", "src/support/a.ts"]),
    commit("bs2", ["src/billing/b.ts", "src/support/b.ts"]),
    commit("fs1", ["src/fulfillment/c.ts", "src/support/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
  ];
}

export function balancedPersistentPairCommits(): CochangeCommit[] {
  return [
    commit("ab1", ["src/billing/a.ts", "src/fulfillment/a.ts"]),
    commit("ab2", ["src/billing/b.ts", "src/fulfillment/b.ts"]),
    commit("ab3", ["src/billing/c.ts", "src/fulfillment/c.ts"]),
    commit("a1", ["src/billing/local.ts"]),
    commit("b1", ["src/fulfillment/local.ts"]),
  ];
}

export function compareCommits(commits: CochangeCommit[]): ComparisonEnvelope {
  const result = compareEvolutionLocalityModels(commits, SYNTHETIC_MODEL);
  return {
    result: result.comparison,
    confidence: result.confidence,
    unknowns: result.unknowns,
  };
}
