import { expect, test } from "vitest";

import { analyzeCochangePersistence, evaluateEvolutionLocalityObservationQuality } from "../src/core/history.js";

import { commit, MODEL } from "./history.helpers.js";

export function registerHistoryLocalityTests() {
  test("reports thin locality evidence from relevant history rather than default confidence", () => {
    const quality = evaluateEvolutionLocalityObservationQuality(
      [commit("c1", ["src/billing/invoice.ts", "src/fulfillment/shipment.ts"])],
      MODEL,
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
        commit("c4", ["src/support/triage.ts"]),
      ],
      MODEL,
    );

    expect(result.analysis.pairWeights[0]).toMatchObject({
      left: "billing",
      right: "fulfillment",
      rawCount: 2,
    });
    expect(result.analysis.pairWeights[0]?.jaccard).toBeGreaterThan(result.analysis.pairWeights[1]?.jaccard ?? 0);
  });
}
