import { describe, expect, test } from "vitest";

import {
  buildMeasurementQualitySummary,
  classifyReviewItemKind,
  sortReviewItems,
} from "../src/core/measurement-metadata.js";
import { metric } from "./report-gate.helpers.js";

describe("measurement metadata", () => {
  test("builds measurement quality summary from metric unknowns and response unknowns", () => {
    const summary = buildMeasurementQualitySummary({
      metrics: [
        metric({ metricId: "QSF", value: 0.6, unknowns: ["QSF is a conservative approximation."] }),
        metric({ metricId: "OAS", value: 0.7, unknowns: ["OAS is partial."] }),
        metric({ metricId: "DDS", value: 0.9 }),
      ],
      unknowns: ["No telemetry observations were provided, so CommonOps is using the neutral value 0.5."],
      confidence: 0.72,
    });

    expect(summary.unknownsCount).toBe(3);
    expect(summary.proxyMetrics).toEqual(["QSF", "OAS"]);
    expect(summary.proxyRate).toBeCloseTo(2 / 3, 10);
    expect(summary.approximationNotes.length).toBeGreaterThan(0);
    expect(summary.decisionRisk).toBe("high");
  });

  test("classifies and sorts review items toward actionable work first", () => {
    const sorted = sortReviewItems([
      {
        reviewItemId: "3",
        reason: "unknown",
        summary: "Recurring cross-boundary hotspot Delivery <-> Core appears in 4 commits.",
        confidence: 0.8,
        evidenceRefs: [],
      },
      {
        reviewItemId: "2",
        reason: "low_confidence",
        summary: "QSF has low confidence",
        confidence: 0.6,
        evidenceRefs: [],
      },
      {
        reviewItemId: "1",
        reason: "unknown",
        summary: "No telemetry observations were provided, so CommonOps is using the neutral value 0.5.",
        confidence: 0.9,
        evidenceRefs: [],
      },
    ]);

    expect(classifyReviewItemKind(sorted[0]?.summary ?? "", sorted[0]?.reason ?? "")).toBe("proxy");
    expect(classifyReviewItemKind(sorted[1]?.summary ?? "", sorted[1]?.reason ?? "")).toBe("low_confidence");
    expect(classifyReviewItemKind(sorted[2]?.summary ?? "", sorted[2]?.reason ?? "")).toBe("history_hotspot");
  });
});
