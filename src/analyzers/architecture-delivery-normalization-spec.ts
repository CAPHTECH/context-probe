import type {
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryRawObservationSet,
} from "../core/contracts.js";

export function buildDefaultDeliveryNormalizationProfile(): ArchitectureDeliveryNormalizationProfile {
  return {
    version: "1.0",
    signals: {
      LeadTime: { direction: "lower_is_better", target: 2, worstAcceptable: 14 },
      DeployFrequency: { direction: "higher_is_better", target: 20, worstAcceptable: 2 },
      RecoveryTime: { direction: "lower_is_better", target: 1, worstAcceptable: 8 },
      ChangeFailRate: { direction: "lower_is_better", target: 0.05, worstAcceptable: 0.4 },
      ReworkRate: { direction: "lower_is_better", target: 0.04, worstAcceptable: 0.35 },
    },
  };
}

export interface DeliverySignalMapping {
  component: "LeadTime" | "DeployFrequency" | "RecoveryTime" | "ChangeFailRate" | "ReworkRate";
  scoreComponent: "LeadTimeScore" | "DeployFreqScore" | "RecoveryScore" | "ChangeFailScore" | "ReworkScore";
  observed: number | undefined;
  rule:
    | ArchitectureDeliveryNormalizationProfile["signals"][keyof ArchitectureDeliveryNormalizationProfile["signals"]]
    | undefined;
  invertForStorage: boolean;
}

export function buildDeliverySignalMappings(input: {
  rawValues: ArchitectureDeliveryRawObservationSet["values"];
  profile: ArchitectureDeliveryNormalizationProfile;
}): DeliverySignalMapping[] {
  const { rawValues, profile } = input;
  return [
    {
      component: "LeadTime",
      scoreComponent: "LeadTimeScore",
      observed: rawValues.LeadTime,
      rule: profile.signals.LeadTime,
      invertForStorage: false,
    },
    {
      component: "DeployFrequency",
      scoreComponent: "DeployFreqScore",
      observed: rawValues.DeployFrequency,
      rule: profile.signals.DeployFrequency,
      invertForStorage: false,
    },
    {
      component: "RecoveryTime",
      scoreComponent: "RecoveryScore",
      observed: rawValues.RecoveryTime,
      rule: profile.signals.RecoveryTime,
      invertForStorage: false,
    },
    {
      component: "ChangeFailRate",
      scoreComponent: "ChangeFailScore",
      observed: rawValues.ChangeFailRate,
      rule: profile.signals.ChangeFailRate,
      invertForStorage: true,
    },
    {
      component: "ReworkRate",
      scoreComponent: "ReworkScore",
      observed: rawValues.ReworkRate,
      rule: profile.signals.ReworkRate,
      invertForStorage: true,
    },
  ];
}
