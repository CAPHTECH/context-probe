import type {
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
} from "../core/contracts.js";
import type {
  DeliveryNormalizationFinding,
  NormalizedDeliveryResult,
} from "./architecture-delivery-normalization-shared.js";
import { buildDeliverySignalMappings } from "./architecture-delivery-normalization-spec.js";
import {
  average,
  clamp01,
  normalizeObservedValue,
  uniqueUnknowns,
} from "./architecture-observation-normalization-shared.js";

export function normalizeDeliveryObservationsCore(input: {
  raw?: ArchitectureDeliveryRawObservationSet;
  profile?: ArchitectureDeliveryNormalizationProfile;
}): NormalizedDeliveryResult {
  const findings: DeliveryNormalizationFinding[] = [];
  const unknowns: string[] = [];
  const rawValues = input.raw?.values;
  const profile = input.profile;

  if (!rawValues) {
    return buildEmptyDeliveryNormalizationResult(
      "No delivery raw observations were provided, so raw normalization is unobserved.",
      0.25,
      findings,
    );
  }

  if (!profile) {
    return buildEmptyDeliveryNormalizationResult(
      "No delivery normalization profile was provided, so raw delivery cannot be scored.",
      0.3,
      findings,
    );
  }

  const normalizedScores: ArchitectureDeliveryObservationSet["scores"] = {};
  let observedSignals = 0;
  const mappings = buildDeliverySignalMappings({ rawValues, profile });

  for (const mapping of mappings) {
    if (!mapping.rule) {
      unknowns.push(`A normalization rule for ${mapping.component} is missing.`);
      findings.push({
        kind: "missing_normalization_rule",
        component: mapping.component,
        scoreComponent: mapping.scoreComponent,
        confidence: 0.58,
        note: `There is no rule to normalize ${mapping.component}.`,
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
        note: `The raw ${mapping.component} signal is missing.`,
      });
      continue;
    }

    const normalized = normalizeObservedValue({
      direction: mapping.rule.direction,
      observed: mapping.observed,
      target: mapping.rule.target,
      worstAcceptable: mapping.rule.worstAcceptable,
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
      note: `${mapping.component} was normalized from raw delivery input to ${storedScore.toFixed(3)}.`,
    });
  }

  return {
    deliveryObservations: {
      version: "1.0",
      scores: normalizedScores,
    },
    confidence: clamp01(
      average(
        [
          Object.keys(rawValues).length > 0 ? 0.82 : 0.25,
          Object.keys(profile.signals).length > 0 ? 0.84 : 0.35,
          observedSignals / mappings.length,
        ],
        0.35,
      ),
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}

function buildEmptyDeliveryNormalizationResult(
  unknown: string,
  confidence: number,
  findings: DeliveryNormalizationFinding[],
): NormalizedDeliveryResult {
  return {
    deliveryObservations: {
      version: "1.0",
      scores: {},
    },
    confidence,
    unknowns: [unknown],
    findings,
  };
}
