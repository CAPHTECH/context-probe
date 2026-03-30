import { expect, test } from "vitest";

import { renderMarkdownReport } from "../src/core/report.js";
import { metric } from "./report-gate.helpers.js";

export function registerReportMarkdownArchitectureTests(): void {
  test("architecture markdown report separates APSI summary from supporting metrics and proxy signals", () => {
    const report = renderMarkdownReport(
      {
        status: "warning",
        result: {
          domainId: "architecture_design",
          metrics: [
            metric({ metricId: "APSI", value: 0.61, unknowns: ["PCS is a proxy composite of DDS, BPS, and IPS."] }),
            metric({ metricId: "QSF", value: 0.7 }),
            metric({ metricId: "DDS", value: 0.82 }),
            metric({ metricId: "BPS", value: 0.8 }),
            metric({ metricId: "IPS", value: 0.76 }),
            metric({ metricId: "OAS", value: 0.54, unknowns: ["OAS is partial."] }),
            metric({ metricId: "EES", value: 0.66 }),
            metric({ metricId: "CTI", value: 0.21 }),
            metric({ metricId: "TIS", value: 0.58, unknowns: ["TIS is a bridge metric."] }),
            metric({ metricId: "AELS", value: 0.63 }),
          ],
          violations: [],
        },
        evidence: [],
        confidence: 0.72,
        unknowns: ["Telemetry observations are missing."],
        diagnostics: [],
        progress: [],
        provenance: [],
        version: "1.0",
      },
      "layered",
    );

    expect(report).toContain("## Architecture Summary");
    expect(report).toContain("APSI is a summary-only metric");
    expect(report).toContain("Policy Profile: layered");
    expect(report).toContain("## Supporting Metrics");
    expect(report).toContain("## Bridge Metrics");
    expect(report).toContain("## Metric Guidance");
    expect(report).toContain("APSI: ideal=");
    expect(report).toContain("QSF: ideal=");
    expect(report).toContain("CTI: ideal=");
    expect(report).toContain("## Proxy / Partial Signals");
    expect(report).toContain("APSI: PCS is a proxy composite of DDS, BPS, and IPS.");
    expect(report).toContain("OAS: OAS is partial.");
    expect(report).toContain("TIS: TIS is a bridge metric.");
  });
}
