import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";

export interface TelemetryBandMapping {
  component: "LatencyScore" | "ErrorScore" | "SaturationScore";
  observed: number | undefined;
  rule:
    | ArchitectureTelemetryNormalizationProfile["signals"][keyof ArchitectureTelemetryNormalizationProfile["signals"]]
    | undefined;
}

export function buildTelemetryBandMappings(input: {
  band: ArchitectureTelemetryRawObservationSet["bands"][number];
  profile: ArchitectureTelemetryNormalizationProfile;
}): TelemetryBandMapping[] {
  const { band, profile } = input;
  return [
    {
      component: "LatencyScore",
      observed: band.latencyP95,
      rule: profile.signals.LatencyScore,
    },
    {
      component: "ErrorScore",
      observed: band.errorRate,
      rule: profile.signals.ErrorScore,
    },
    {
      component: "SaturationScore",
      observed: band.saturationRatio,
      rule: profile.signals.SaturationScore,
    },
  ];
}
