import { describe, expect, test } from "vitest";

import { normalizeDeliveryObservationsCore } from "../src/analyzers/architecture-delivery-normalization-core.js";
import { resolveFallbackPatternRuntime } from "../src/analyzers/architecture-pattern-runtime-fallback.js";
import { normalizeTelemetryObservationsCore } from "../src/analyzers/architecture-telemetry-normalization-core.js";

describe("architecture runtime normalization", () => {
  test("delivery normalization reports missing profile, missing rules, and missing raw signals", () => {
    expect(normalizeDeliveryObservationsCore({})).toEqual(
      expect.objectContaining({
        confidence: 0.25,
        unknowns: ["No delivery raw observations were provided, so raw normalization is unobserved."],
      }),
    );

    const withoutProfile = normalizeDeliveryObservationsCore({
      raw: {
        version: "1.0",
        values: { LeadTime: 2 },
      },
    });
    expect(withoutProfile.unknowns).toEqual([
      "No delivery normalization profile was provided, so raw delivery cannot be scored.",
    ]);

    const partial = normalizeDeliveryObservationsCore({
      raw: {
        version: "1.0",
        values: {
          LeadTime: 2,
          DeployFrequency: 5,
        },
      },
      profile: {
        version: "1.0",
        signals: {
          LeadTime: { direction: "lower_is_better", target: 1, worstAcceptable: 5 },
          ChangeFailRate: { direction: "lower_is_better", target: 0.05, worstAcceptable: 0.3 },
        },
      },
    });

    expect(partial.deliveryObservations.scores.LeadTimeScore).toBeGreaterThan(0);
    expect(partial.unknowns).toEqual(
      expect.arrayContaining([
        "A normalization rule for DeployFrequency is missing.",
        "A normalization rule for RecoveryTime is missing.",
        "The raw ChangeFailRate signal is missing.",
      ]),
    );
    expect(partial.findings.some((finding) => finding.kind === "missing_normalization_rule")).toBe(true);
    expect(partial.findings.some((finding) => finding.kind === "missing_raw_signal")).toBe(true);
  });

  test("telemetry normalization preserves raw bands for missing profile and records partial normalization gaps", () => {
    const noProfile = normalizeTelemetryObservationsCore({
      raw: {
        version: "1.0",
        bands: [{ bandId: "steady", trafficWeight: 0.7, latencyP95: 120 }],
      },
    });

    expect(noProfile.telemetry.bands).toEqual([{ bandId: "steady", trafficWeight: 0.7 }]);
    expect(noProfile.unknowns).toEqual([
      "No telemetry normalization profile was provided, so raw telemetry cannot be scored.",
    ]);

    const partial = normalizeTelemetryObservationsCore({
      raw: {
        version: "1.0",
        bands: [
          { bandId: "steady", trafficWeight: 0.7, latencyP95: 120 },
          { bandId: "burst", trafficWeight: 0.3, errorRate: 0.08, saturationRatio: 0.75 },
        ],
      },
      profile: {
        version: "1.0",
        signals: {
          LatencyScore: { direction: "lower_is_better", target: 80, worstAcceptable: 200 },
          ErrorScore: { direction: "lower_is_better", target: 0.01, worstAcceptable: 0.1 },
        },
      },
    });

    expect(partial.telemetry.bands[0]?.LatencyScore).toBeGreaterThan(0);
    expect(partial.telemetry.bands[1]?.ErrorScore).toBeGreaterThan(0);
    expect(partial.unknowns).toEqual(
      expect.arrayContaining([
        "steady is missing the raw ErrorScore signal.",
        "steady is missing a normalization rule for SaturationScore.",
        "burst is missing a normalization rule for SaturationScore.",
      ]),
    );
  });

  test("pattern runtime fallback covers legacy, TIS bridge, and neutral paths", () => {
    const legacy = resolveFallbackPatternRuntime({
      observations: {
        version: "1.0",
        patternFamily: "layered",
        score: 1.2,
      },
      findings: [],
      unknowns: [],
    });
    expect(legacy.source).toBe("legacy");
    expect(legacy.value).toBe(1);
    expect(legacy.patternFamily).toBe("layered");

    const bridged = resolveFallbackPatternRuntime({
      observations: {
        version: "1.0",
        patternFamily: "microservices",
      },
      topologyIsolationBridge: 0.42,
      findings: [],
      unknowns: [],
    });
    expect(bridged.source).toBe("tis_bridge");
    expect(bridged.value).toBe(0.42);
    expect(bridged.unknowns).toContain(
      "No pattern runtime observations were provided, so PatternRuntime is using the TIS bridge.",
    );

    const neutral = resolveFallbackPatternRuntime({
      observations: undefined,
      findings: [],
      unknowns: [],
    });
    expect(neutral.source).toBe("neutral");
    expect(neutral.value).toBe(0.5);
    expect(neutral.unknowns).toContain(
      "No pattern runtime observations were provided, so PatternRuntime is using the neutral value 0.5.",
    );
  });
});
