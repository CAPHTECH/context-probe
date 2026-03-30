import type { DomainPolicy } from "./contracts.js";

export function createArchitectureDesignPolicy(apsiFormula: string): DomainPolicy {
  return {
    metrics: {
      QSF: {
        formula: "QSF",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      DDS: {
        formula: "0.60*(1-IDR) + 0.25*LRC + 0.15*APM",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      BPS: {
        formula: "0.45*(1-ALR) + 0.30*FCC + 0.25*(1-SICR)",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      IPS: {
        formula: "0.50*CBC + 0.25*(1-BCR) + 0.25*SLA",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      TIS: {
        formula: "0.40*FI + 0.30*RC + 0.30*(1-SDR)",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      OAS: {
        formula: "0.50*CommonOps + 0.50*PatternRuntime",
        thresholds: {
          warn: 0.72,
          fail: 0.58,
        },
      },
      CTI: {
        formula:
          "0.20*DeployablesPerTeam + 0.15*PipelinesPerDeployable + 0.15*ContractsOrSchemasPerService + 0.10*DatastoresPerServiceGroup + 0.15*OnCallSurface + 0.10*SyncDepthOverhead + 0.15*RunCostPerBusinessTransaction",
      },
      AELS: {
        formula: "0.40*(1-CrossBoundaryCoChange) + 0.30*(1-WeightedPropagationCost) + 0.30*(1-WeightedClusteringCost)",
        thresholds: {
          warn: 0.68,
          fail: 0.5,
        },
      },
      EES: {
        formula: "0.60*Delivery + 0.40*Locality",
        thresholds: {
          warn: 0.68,
          fail: 0.5,
        },
      },
      APSI: {
        formula: apsiFormula,
        thresholds: {
          warn: 0.68,
          fail: 0.52,
        },
      },
    },
    review: {
      require_human_if: ["confidence < 0.80", "breaking_change_detected == true"],
    },
  };
}
