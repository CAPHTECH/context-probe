import { describe, expect, test } from "vitest";

import { DEFAULT_POLICY } from "../src/core/policy.js";
import { evaluateGate, renderMarkdownReport } from "../src/core/report.js";

function metric(input: {
  metricId: string;
  value: number;
  confidence?: number;
  components?: Record<string, number>;
  unknowns?: string[];
}): {
  metricId: string;
  value: number;
  components: Record<string, number>;
  confidence: number;
  evidenceRefs: string[];
  unknowns: string[];
} {
  return {
    metricId: input.metricId,
    value: input.value,
    components: input.components ?? {},
    confidence: input.confidence ?? 0.9,
    evidenceRefs: [],
    unknowns: input.unknowns ?? []
  };
}

describe("report and gate", () => {
  test("architecture markdown report separates APSI summary from supporting metrics and proxy signals", () => {
    const report = renderMarkdownReport({
      status: "warning",
      result: {
        domainId: "architecture_design",
        metrics: [
          metric({ metricId: "APSI", value: 0.61, unknowns: ["PCS は DDS/BPS/IPS の proxy 合成です"] }),
          metric({ metricId: "QSF", value: 0.7 }),
          metric({ metricId: "DDS", value: 0.82 }),
          metric({ metricId: "BPS", value: 0.8 }),
          metric({ metricId: "IPS", value: 0.76 }),
          metric({ metricId: "OAS", value: 0.54, unknowns: ["OAS は partial 実装です"] }),
          metric({ metricId: "EES", value: 0.66 }),
          metric({ metricId: "CTI", value: 0.21 }),
          metric({ metricId: "TIS", value: 0.58, unknowns: ["TIS は bridge です"] }),
          metric({ metricId: "AELS", value: 0.63 })
        ],
        violations: []
      },
      evidence: [],
      confidence: 0.72,
      unknowns: ["telemetry observations が不足しています"],
      diagnostics: [],
      provenance: [],
      version: "1.0"
    }, "layered");

    expect(report).toContain("## Architecture Summary");
    expect(report).toContain("APSI is a summary-only metric");
    expect(report).toContain("Policy Profile: layered");
    expect(report).toContain("## Supporting Metrics");
    expect(report).toContain("## Bridge Metrics");
    expect(report).toContain("## Proxy / Partial Signals");
    expect(report).toContain("APSI: PCS は DDS/BPS/IPS の proxy 合成です");
    expect(report).toContain("OAS: OAS は partial 実装です");
    expect(report).toContain("TIS: TIS は bridge です");
  });

  test("gate does not fail architecture runs on APSI alone when supporting metrics are healthy", () => {
    const gate = evaluateGate(
      {
        status: "ok",
        result: {
          domainId: "architecture_design",
          metrics: [
            metric({ metricId: "QSF", value: 0.8 }),
            metric({ metricId: "DDS", value: 0.9 }),
            metric({ metricId: "BPS", value: 0.88 }),
            metric({ metricId: "IPS", value: 0.76 }),
            metric({ metricId: "OAS", value: 0.74 }),
            metric({ metricId: "EES", value: 0.71 }),
            metric({ metricId: "CTI", value: 0.22 }),
            metric({ metricId: "APSI", value: 0.4 })
          ]
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0"
      },
      DEFAULT_POLICY,
      "default"
    );

    expect(gate.status).toBe("warning");
    expect(gate.failures).toHaveLength(0);
    expect(gate.warnings.some((entry) => entry.includes("APSI=0.400 < summary_fail"))).toBe(true);
  });

  test("gate still fails when supporting architecture metrics breach fail thresholds", () => {
    const gate = evaluateGate(
      {
        status: "ok",
        result: {
          domainId: "architecture_design",
          metrics: [
            metric({ metricId: "QSF", value: 0.41 }),
            metric({ metricId: "DDS", value: 0.9 }),
            metric({ metricId: "BPS", value: 0.88 }),
            metric({ metricId: "IPS", value: 0.76 }),
            metric({ metricId: "OAS", value: 0.74 }),
            metric({ metricId: "EES", value: 0.71 }),
            metric({ metricId: "CTI", value: 0.22 }),
            metric({ metricId: "APSI", value: 0.39 })
          ]
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0"
      },
      DEFAULT_POLICY,
      "default"
    );

    expect(gate.status).toBe("error");
    expect(gate.failures.some((entry) => entry.includes("QSF=0.410 < fail"))).toBe(true);
  });
});
