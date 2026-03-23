import type {
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ScenarioDirection
} from "../core/contracts.js";

export interface DeliveryNormalizationFinding {
  kind: "normalized_signal" | "missing_raw_signal" | "missing_normalization_rule";
  confidence: number;
  note: string;
  component: "LeadTime" | "DeployFrequency" | "RecoveryTime" | "ChangeFailRate" | "ReworkRate";
  scoreComponent:
    | "LeadTimeScore"
    | "DeployFreqScore"
    | "RecoveryScore"
    | "ChangeFailScore"
    | "ReworkScore";
  observed?: number;
  normalized?: number;
}

export interface NormalizedDeliveryResult {
  deliveryObservations: ArchitectureDeliveryObservationSet;
  confidence: number;
  unknowns: string[];
  findings: DeliveryNormalizationFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueUnknowns(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeObservedValue(input: {
  direction: ScenarioDirection;
  observed: number;
  target: number;
  worstAcceptable: number;
}): number {
  const { direction, observed, target, worstAcceptable } = input;
  if (direction === "lower_is_better") {
    return clamp01((worstAcceptable - observed) / Math.max(0.0001, worstAcceptable - target));
  }
  return clamp01((observed - worstAcceptable) / Math.max(0.0001, target - worstAcceptable));
}

export function normalizeDeliveryObservations(input: {
  raw?: ArchitectureDeliveryRawObservationSet;
  profile?: ArchitectureDeliveryNormalizationProfile;
}): NormalizedDeliveryResult {
  const findings: DeliveryNormalizationFinding[] = [];
  const unknowns: string[] = [];
  const rawValues = input.raw?.values;
  const profile = input.profile;

  if (!rawValues) {
    return {
      deliveryObservations: {
        version: "1.0",
        scores: {}
      },
      confidence: 0.25,
      unknowns: ["No delivery raw observations were provided, so raw normalization is unobserved."],
      findings
    };
  }

  if (!profile) {
    return {
      deliveryObservations: {
        version: "1.0",
        scores: {}
      },
      confidence: 0.3,
      unknowns: ["No delivery normalization profile was provided, so raw delivery cannot be scored."],
      findings
    };
  }

  const normalizedScores: ArchitectureDeliveryObservationSet["scores"] = {};
  let observedSignals = 0;
  const mappings = [
    {
      component: "LeadTime" as const,
      scoreComponent: "LeadTimeScore" as const,
      observed: rawValues.LeadTime,
      rule: profile.signals.LeadTime,
      invertForStorage: false
    },
    {
      component: "DeployFrequency" as const,
      scoreComponent: "DeployFreqScore" as const,
      observed: rawValues.DeployFrequency,
      rule: profile.signals.DeployFrequency,
      invertForStorage: false
    },
    {
      component: "RecoveryTime" as const,
      scoreComponent: "RecoveryScore" as const,
      observed: rawValues.RecoveryTime,
      rule: profile.signals.RecoveryTime,
      invertForStorage: false
    },
    {
      component: "ChangeFailRate" as const,
      scoreComponent: "ChangeFailScore" as const,
      observed: rawValues.ChangeFailRate,
      rule: profile.signals.ChangeFailRate,
      invertForStorage: true
    },
    {
      component: "ReworkRate" as const,
      scoreComponent: "ReworkScore" as const,
      observed: rawValues.ReworkRate,
      rule: profile.signals.ReworkRate,
      invertForStorage: true
    }
  ];

  for (const mapping of mappings) {
    if (!mapping.rule) {
      unknowns.push(`A normalization rule for ${mapping.component} is missing.`);
      findings.push({
        kind: "missing_normalization_rule",
        component: mapping.component,
        scoreComponent: mapping.scoreComponent,
        confidence: 0.58,
        note: `There is no rule to normalize ${mapping.component}.`
      });
      continue;
    }
    if (mapping.observed === undefined) {
      unknowns.push(`The raw ${mapping.component} signal is missing.`);
      findings.push({
        kind: "missing_raw_signal",
        component: mapping.component,
        scoreComponent: mapping.scoreComponent,
        confidence: 0.62,
        note: `The raw ${mapping.component} signal is missing.`
      });
      continue;
    }

    const normalized = normalizeObservedValue({
      direction: mapping.rule.direction,
      observed: mapping.observed,
      target: mapping.rule.target,
      worstAcceptable: mapping.rule.worstAcceptable
    });
    const storedScore = mapping.invertForStorage ? 1 - normalized : normalized;
    normalizedScores[mapping.scoreComponent] = storedScore;
    observedSignals += 1;
    findings.push({
      kind: "normalized_signal",
      component: mapping.component,
      scoreComponent: mapping.scoreComponent,
      observed: mapping.observed,
      normalized: storedScore,
      confidence: 0.86,
      note: `${mapping.component} was normalized from raw delivery input to ${storedScore.toFixed(3)}.`
    });
  }

  return {
    deliveryObservations: {
      version: "1.0",
      scores: normalizedScores
    },
    confidence: clamp01(
      average(
        [
          Object.keys(rawValues).length > 0 ? 0.82 : 0.25,
          Object.keys(profile.signals).length > 0 ? 0.84 : 0.35,
          observedSignals / mappings.length
        ],
        0.35
      )
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}
