import { expect, test } from "vitest";

import { renderMarkdownReport } from "../src/core/report.js";
import { metric } from "./report-gate.helpers.js";

export function registerReportMarkdownDomainTests(): void {
  test("domain markdown report includes actionable metric guidance", () => {
    const report = renderMarkdownReport({
      status: "ok",
      result: {
        domainId: "domain_design",
        metrics: [
          metric({ metricId: "DRF", value: 0.74 }),
          metric({ metricId: "ULI", value: 0.68 }),
          metric({ metricId: "MCCS", value: 0.61 }),
        ],
        leakFindings: [],
      },
      evidence: [],
      confidence: 0.8,
      unknowns: [],
      diagnostics: [],
      progress: [],
      provenance: [],
      version: "1.0",
    });

    expect(report).toContain("## Metrics");
    expect(report).toContain("## Metric Guidance");
    expect(report).toContain("DRF: ideal=");
    expect(report).toContain("ULI: ideal=");
    expect(report).toContain("MCCS: ideal=");
    expect(report).toContain("next=");
  });

  test("domain markdown report includes pilot rollout details when present", () => {
    const report = renderMarkdownReport({
      status: "warning",
      result: {
        domainId: "domain_design",
        metrics: [
          metric({ metricId: "ELS", value: 0.63, components: { CCL: 0.7, FS: 0.2, SCR: 0.4 } }),
          metric({ metricId: "MCCS", value: 0.72 }),
        ],
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
        leakFindings: [],
      },
      evidence: [],
      confidence: 0.8,
      unknowns: [],
      diagnostics: [],
      progress: [],
      provenance: [],
      version: "1.0",
    });

    expect(report).toContain("## Pilot Rollout");
    expect(report).toContain("- Category: application");
    expect(report).toContain("- Applied: yes");
    expect(report).toContain("- Locality Source: persistence_candidate");
    expect(report).toContain("- Baseline ELS: 0.630");
    expect(report).toContain("- Persistence Candidate: 0.810");
    expect(report).toContain("- Effective ELS: 0.810");
    expect(report).toContain("- Overall Gate: shadow_only (no_go)");
    expect(report).toContain("- Category Gate: replace (go)");
    expect(report.indexOf("## Pilot Rollout")).toBeGreaterThan(report.indexOf("## Metrics"));
    expect(report.indexOf("## Metric Guidance")).toBeGreaterThan(report.indexOf("## Pilot Rollout"));
  });

  test("domain markdown report omits pilot rollout section when pilot is absent", () => {
    const report = renderMarkdownReport({
      status: "ok",
      result: {
        domainId: "domain_design",
        metrics: [metric({ metricId: "ELS", value: 0.63, components: { CCL: 0.7, FS: 0.2, SCR: 0.4 } })],
        leakFindings: [],
      },
      evidence: [],
      confidence: 0.8,
      unknowns: [],
      diagnostics: [],
      progress: [],
      provenance: [],
      version: "1.0",
    });

    expect(report).not.toContain("## Pilot Rollout");
  });
}
