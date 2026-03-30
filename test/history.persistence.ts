import { expect, test } from "vitest";

import { analyzeCochangePersistence, compareEvolutionLocalityModels } from "../src/core/history.js";

import { commit, MODEL } from "./history.helpers.js";

export function registerHistoryPersistenceTests() {
  test("summarizes stable clusters and handles identical filtration weights", () => {
    const stableResult = analyzeCochangePersistence(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"]),
        commit("abc1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts", "src/support/ticket.ts"]),
      ],
      MODEL,
    );

    expect(stableResult.analysis.stableChangeClusters[0]?.contexts).toEqual(["billing", "fulfillment"]);
    expect(stableResult.analysis.stableChangeClusters[0]?.stability).toBeGreaterThan(0.5);
    expect(stableResult.analysis.naturalSplitLevels[0]).toBeCloseTo(1, 6);
    expect(stableResult.analysis.noiseRatio).toBeGreaterThanOrEqual(0);
    expect(stableResult.analysis.noiseRatio).toBeLessThanOrEqual(1);

    const equalWeightResult = analyzeCochangePersistence(
      [
        commit("ab", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ac", ["src/billing/pricing.ts", "src/support/ticket.ts"]),
        commit("bc", ["src/fulfillment/picker.ts", "src/support/escalation.ts"]),
      ],
      MODEL,
    );

    expect(equalWeightResult.analysis.pairWeights).toHaveLength(3);
    expect(equalWeightResult.unknowns.some((entry) => entry.includes("identical"))).toBe(true);
  });

  test("de-emphasizes hub contexts relative to balanced persistent coupling", () => {
    const hubHeavy = compareEvolutionLocalityModels(
      [
        commit("s1", ["src/support/ticket.ts"]),
        commit("s2", ["src/support/escalation.ts"]),
        commit("bs1", ["src/billing/invoice.ts", "src/support/ticket.ts"]),
        commit("bs2", ["src/billing/pricing.ts", "src/support/escalation.ts"]),
        commit("fs1", ["src/fulfillment/picker.ts", "src/support/queue.ts"]),
        commit("b1", ["src/billing/refund.ts"]),
        commit("f1", ["src/fulfillment/shipment.ts"]),
      ],
      MODEL,
    );
    const balancedCoupling = compareEvolutionLocalityModels(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"]),
        commit("b1", ["src/billing/credit.ts"]),
        commit("f1", ["src/fulfillment/tracking.ts"]),
      ],
      MODEL,
    );

    expect(hubHeavy.comparison.persistenceCandidate.localityScore).toBeGreaterThan(
      balancedCoupling.comparison.persistenceCandidate.localityScore,
    );
    expect(hubHeavy.comparison.persistenceCandidate.strongestPair?.jaccard ?? 0).toBeLessThan(
      balancedCoupling.comparison.persistenceCandidate.strongestPair?.jaccard ?? 1,
    );
  });
}
