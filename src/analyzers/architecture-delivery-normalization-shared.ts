import type { ArchitectureDeliveryObservationSet } from "../core/contracts.js";

export interface DeliveryNormalizationFinding {
  kind: "normalized_signal" | "missing_raw_signal" | "missing_normalization_rule";
  confidence: number;
  note: string;
  component: "LeadTime" | "DeployFrequency" | "RecoveryTime" | "ChangeFailRate" | "ReworkRate";
  scoreComponent: "LeadTimeScore" | "DeployFreqScore" | "RecoveryScore" | "ChangeFailScore" | "ReworkScore";
  observed?: number;
  normalized?: number;
}

export interface NormalizedDeliveryResult {
  deliveryObservations: ArchitectureDeliveryObservationSet;
  confidence: number;
  unknowns: string[];
  findings: DeliveryNormalizationFinding[];
}
