import { describe, expect, test } from "vitest";

import type { CochangeCommit, DomainModel } from "../src/core/contracts.js";
import {
  analyzeCochangePersistence,
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality
} from "../src/core/history.js";

const MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] }
  ]
};

function commit(hash: string, files: string[]): CochangeCommit {
  return {
    hash,
    subject: hash,
    files
  };
}

describe("history analysis", () => {
  test("reports thin locality evidence from relevant history rather than default confidence", () => {
    const quality = evaluateEvolutionLocalityObservationQuality(
      [commit("c1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"])],
      MODEL
    );

    expect(quality.confidence).toBeLessThan(1);
    expect(quality.unknowns).toContain("Git history is still thin, so ELS is provisional.");
  });

  test("ranks co-change pairs by Jaccard instead of raw count alone", () => {
    const result = analyzeCochangePersistence(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ac1", ["src/billing/invoice.ts", "src/support/ticket.ts"]),
        commit("ac2", ["src/billing/pricing.ts", "src/support/escalation.ts"]),
        commit("ac3", ["src/billing/refund.ts", "src/support/ticket.ts"]),
        commit("c1", ["src/support/ticket.ts"]),
        commit("c2", ["src/support/escalation.ts"]),
        commit("c3", ["src/support/queue.ts"]),
        commit("c4", ["src/support/triage.ts"])
      ],
      MODEL
    );

    expect(result.analysis.pairWeights[0]).toMatchObject({
      left: "billing",
      right: "fulfillment",
      rawCount: 2
    });
    expect(result.analysis.pairWeights[0]?.jaccard).toBeGreaterThan(
      result.analysis.pairWeights[1]?.jaccard ?? 0
    );
  });

  test("summarizes stable clusters and handles identical filtration weights", () => {
    const stableResult = analyzeCochangePersistence(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"]),
        commit("abc1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts", "src/support/ticket.ts"])
      ],
      MODEL
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
        commit("bc", ["src/fulfillment/picker.ts", "src/support/escalation.ts"])
      ],
      MODEL
    );

    expect(equalWeightResult.analysis.pairWeights).toHaveLength(3);
    expect(equalWeightResult.unknowns.some((entry) => entry.includes("identical"))).toBe(true);
  });

  test("scores localized histories higher than persistent cross-context coupling", () => {
    const localized = compareEvolutionLocalityModels(
      [
        commit("b1", ["src/billing/invoice.ts"]),
        commit("f1", ["src/fulfillment/shipment.ts"]),
        commit("b2", ["src/billing/pricing.ts"])
      ],
      MODEL
    );
    const coupled = compareEvolutionLocalityModels(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"])
      ],
      MODEL
    );

    expect(localized.comparison.els.score).toBeGreaterThan(coupled.comparison.els.score);
    expect(localized.comparison.persistenceCandidate.localityScore).toBeGreaterThan(
      coupled.comparison.persistenceCandidate.localityScore
    );
    expect(coupled.comparison.persistenceCandidate.strongestPair?.jaccard).toBeGreaterThan(0.9);
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
        commit("f1", ["src/fulfillment/shipment.ts"])
      ],
      MODEL
    );
    const balancedCoupling = compareEvolutionLocalityModels(
      [
        commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
        commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
        commit("ab3", ["src/billing/refund.ts", "src/fulfillment/carrier.ts"]),
        commit("b1", ["src/billing/credit.ts"]),
        commit("f1", ["src/fulfillment/tracking.ts"])
      ],
      MODEL
    );

    expect(hubHeavy.comparison.persistenceCandidate.localityScore).toBeGreaterThan(
      balancedCoupling.comparison.persistenceCandidate.localityScore
    );
    expect(hubHeavy.comparison.persistenceCandidate.strongestPair?.jaccard ?? 0).toBeLessThan(
      balancedCoupling.comparison.persistenceCandidate.strongestPair?.jaccard ?? 1
    );
  });

  test("remains deterministic across commit ordering", () => {
    const commits = [
      commit("ab1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"]),
      commit("ab2", ["src/billing/pricing.ts", "src/fulfillment/picker.ts"]),
      commit("s1", ["src/support/ticket.ts"]),
      commit("bs1", ["src/billing/refund.ts", "src/support/escalation.ts"])
    ];
    const forward = compareEvolutionLocalityModels(commits, MODEL);
    const reversed = compareEvolutionLocalityModels([...commits].reverse(), MODEL);

    expect(reversed.comparison).toEqual(forward.comparison);
    expect(reversed.unknowns).toEqual(forward.unknowns);
    expect(reversed.confidence).toBe(forward.confidence);
  });
});
