import type { ArchitectureDeliveryObservationSet } from "../core/contracts.js";
import {
  type ArchitectureEvolutionEfficiencyScore,
  type ArchitectureEvolutionFinding,
  average,
  clamp01,
  uniqueUnknowns,
} from "./architecture-evolution-shared.js";

export function scoreArchitectureEvolutionEfficiency(options: {
  deliveryObservations?: ArchitectureDeliveryObservationSet;
  locality: number;
  localityUnknowns?: string[];
  localityConfidence: number;
}): ArchitectureEvolutionEfficiencyScore {
  const findings: ArchitectureEvolutionFinding[] = [];
  const unknowns: string[] = [...(options.localityUnknowns ?? [])];
  const scores = options.deliveryObservations?.scores;
  const weightedComponents = [
    {
      component: "LeadTimeScore" as const,
      weight: 0.25,
      value: scores?.LeadTimeScore,
      note: "Applying lead time score to delivery efficiency.",
    },
    {
      component: "DeployFreqScore" as const,
      weight: 0.2,
      value: scores?.DeployFreqScore,
      note: "Applying deployment frequency score to delivery efficiency.",
    },
    {
      component: "RecoveryScore" as const,
      weight: 0.2,
      value: scores?.RecoveryScore,
      note: "Applying recovery score to delivery efficiency.",
    },
    {
      component: "ChangeFailScore" as const,
      weight: 0.2,
      value: scores?.ChangeFailScore,
      invert: true,
      note: "Applying the inverted change-fail score to delivery efficiency.",
    },
    {
      component: "ReworkScore" as const,
      weight: 0.15,
      value: scores?.ReworkScore,
      invert: true,
      note: "Applying the inverted deployment-rework score to delivery efficiency.",
    },
  ];

  let observedWeight = 0;
  let weightedSum = 0;
  for (const entry of weightedComponents) {
    if (entry.value === undefined) {
      unknowns.push(`${entry.component} is missing, so Delivery is only a partial approximation.`);
      findings.push({
        kind: "missing_delivery_observation",
        component: entry.component,
        confidence: 0.45,
        note: `${entry.component} was not provided.`,
      });
      continue;
    }
    const normalized = clamp01(entry.invert ? 1 - entry.value : entry.value);
    observedWeight += entry.weight;
    weightedSum += entry.weight * normalized;
    if (normalized < 0.5) {
      findings.push({
        kind: "weak_delivery_score",
        component: entry.component,
        confidence: 0.76,
        note: `${entry.note} (normalized=${normalized.toFixed(3)})`,
      });
    }
  }

  const Delivery = observedWeight > 0 ? weightedSum / observedWeight : 0.5;
  if (!scores) {
    unknowns.push("No delivery observations were provided, so Delivery is using the neutral value 0.5.");
  }

  return {
    Delivery,
    Locality: options.locality,
    confidence: clamp01(
      average(
        [observedWeight > 0 ? 0.82 * observedWeight + 0.35 * (1 - observedWeight) : 0.3, options.localityConfidence],
        0.4,
      ),
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings,
  };
}
