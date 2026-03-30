import { expect, test } from "vitest";

import { compareEvolutionLocalityModels } from "../src/core/history.js";

import { commit, MODEL } from "./history.helpers.js";

export function registerHistoryComparisonTests() {
  test("scores localized histories higher than persistent cross-context coupling", () => {
    const localized = compareEvolutionLocalityModels(
      [
        commit("b1", ["src/billing/invoice.ts"]),
        commit("f1", ["src/fulfillment/shipment.ts"]),
        commit("b2", ["src/billing/pricing.ts"]),
      ],
      MODEL,
    );
    const coupled = compareEvolutionLocalityModels(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"]),
      ],
      MODEL,
    );

    expect(localized.comparison.els.score).toBeGreaterThan(coupled.comparison.els.score);
    expect(localized.comparison.persistenceCandidate.localityScore).toBeGreaterThan(
      coupled.comparison.persistenceCandidate.localityScore,
    );
    expect(coupled.comparison.persistenceCandidate.strongestPair?.jaccard).toBeGreaterThan(0.9);
  });

  test("remains deterministic across commit ordering", () => {
    const commits = [
      commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
      commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
      commit("s1", ["src/support/ticket.ts"]),
      commit("bs1", ["src/billing/refund.ts", "src/support/escalation.ts"]),
    ];
    const forward = compareEvolutionLocalityModels(commits, MODEL);
    const reversed = compareEvolutionLocalityModels([...commits].reverse(), MODEL);

    expect(reversed.comparison).toEqual(forward.comparison);
    expect(reversed.unknowns).toEqual(forward.unknowns);
    expect(reversed.confidence).toBe(forward.confidence);
  });

  test("falls back to baseline locality when no relevant history is available", () => {
    const result = compareEvolutionLocalityModels([], MODEL);

    expect(result.comparison.els.score).toBeCloseTo(0.6, 6);
    expect(result.comparison.persistenceCandidate.localityScore).toBeCloseTo(result.comparison.els.score, 6);
    expect(result.comparison.persistenceCandidate.strongestPair).toBeNull();
    expect(result.comparison.persistenceCandidate.strongestCluster).toBeNull();
    expect(result.confidence).toBeLessThan(0.4);
    expect(result.unknowns).toContain("No Git commits suitable for evaluation were found.");
  });
}
