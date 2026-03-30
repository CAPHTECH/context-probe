import { expect, test } from "vitest";

import { DEFAULT_POLICY } from "../src/core/policy.js";
import { evaluateGate } from "../src/core/report.js";
import { metric } from "./report-gate.helpers.js";

export function registerReportGateEvaluationTests(): void {
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
            metric({ metricId: "APSI", value: 0.4 }),
          ],
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0",
      },
      DEFAULT_POLICY,
      "default",
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
            metric({ metricId: "APSI", value: 0.39 }),
          ],
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0",
      },
      DEFAULT_POLICY,
      "default",
    );

    expect(gate.status).toBe("error");
    expect(gate.failures.some((entry) => entry.includes("QSF=0.410 < fail"))).toBe(true);
  });

  test("gate evaluation ignores pilot metadata and only reads metric thresholds", () => {
    const baseline = evaluateGate(
      {
        status: "ok",
        result: {
          domainId: "domain_design",
          metrics: [metric({ metricId: "ELS", value: 0.63, components: { CCL: 0.7, FS: 0.2, SCR: 0.4 } })],
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0",
      },
      DEFAULT_POLICY,
      "default",
    );
    const withPilot = evaluateGate(
      {
        status: "ok",
        result: {
          domainId: "domain_design",
          metrics: [metric({ metricId: "ELS", value: 0.63, components: { CCL: 0.7, FS: 0.2, SCR: 0.4 } })],
          pilot: {
            category: "application",
            applied: true,
            localitySource: "persistence_candidate",
            baselineElsValue: 0.63,
            persistenceCandidateValue: 0.81,
            effectiveElsValue: 0.81,
            overallGate: {
              reasons: ["real_repo_delta_range_above_threshold"],
              replacementVerdict: "no_go",
              rolloutDisposition: "shadow_only",
            },
            categoryGate: {
              reasons: [],
              replacementVerdict: "go",
              rolloutDisposition: "replace",
            },
          },
        },
        evidence: [],
        confidence: 0.82,
        unknowns: [],
        diagnostics: [],
        provenance: [],
        version: "1.0",
      } as Parameters<typeof evaluateGate>[0],
      DEFAULT_POLICY,
      "default",
    );

    expect(withPilot).toEqual(baseline);
  });
}
