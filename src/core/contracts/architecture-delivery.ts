import type { TelemetryNormalizationRule } from "./architecture-normalization.js";
import type { ArchitectureCanonicalSourceConfig } from "./architecture-scenarios.js";

export interface ArchitectureDeliveryObservationSet {
  version: string;
  scores: {
    LeadTimeScore?: number;
    DeployFreqScore?: number;
    RecoveryScore?: number;
    ChangeFailScore?: number;
    ReworkScore?: number;
  };
}

export interface ArchitectureDeliveryRawObservationSet {
  version: string;
  values: {
    LeadTime?: number;
    DeployFrequency?: number;
    RecoveryTime?: number;
    ChangeFailRate?: number;
    ReworkRate?: number;
  };
  source?: string;
  note?: string;
}

export interface ArchitectureDeliveryExportBundle {
  version: string;
  sourceSystem?: string;
  measurements: {
    leadTime?: number;
    deployFrequency?: number;
    recoveryTime?: number;
    changeFailRate?: number;
    reworkRate?: number;
  };
  note?: string;
}

export interface ArchitectureDeliverySourceConfig extends ArchitectureCanonicalSourceConfig {}

export interface ArchitectureDeliveryNormalizationProfile {
  version: string;
  signals: Partial<
    Record<
      "LeadTime" | "DeployFrequency" | "RecoveryTime" | "ChangeFailRate" | "ReworkRate",
      TelemetryNormalizationRule
    >
  >;
}
