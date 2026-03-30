import type {
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryRawObservationSet,
} from "../core/contracts.js";
import { normalizeTelemetryObservationsCore } from "./architecture-telemetry-normalization-core.js";

export type {
  NormalizedTelemetryResult,
  TelemetryNormalizationFinding,
} from "./architecture-telemetry-normalization-shared.js";

export function normalizeTelemetryObservations(input: {
  raw?: ArchitectureTelemetryRawObservationSet;
  profile?: ArchitectureTelemetryNormalizationProfile;
}): import("./architecture-telemetry-normalization-shared.js").NormalizedTelemetryResult {
  return normalizeTelemetryObservationsCore(input);
}
