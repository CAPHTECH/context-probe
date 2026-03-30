import type {
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryRawObservationSet,
} from "../core/contracts.js";
import { normalizeDeliveryObservationsCore } from "./architecture-delivery-normalization-core.js";

export type {
  DeliveryNormalizationFinding,
  NormalizedDeliveryResult,
} from "./architecture-delivery-normalization-shared.js";

export function normalizeDeliveryObservations(input: {
  raw?: ArchitectureDeliveryRawObservationSet;
  profile?: ArchitectureDeliveryNormalizationProfile;
}): import("./architecture-delivery-normalization-shared.js").NormalizedDeliveryResult {
  return normalizeDeliveryObservationsCore(input);
}
