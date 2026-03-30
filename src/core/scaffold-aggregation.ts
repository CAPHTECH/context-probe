import type { ArchitectureLayerCandidate, DomainContextCandidate, Evidence } from "./contracts.js";
import { unique } from "./scaffold-naming.js";

export function mergeEvidence(candidates: Array<{ evidence: Evidence[] }>): Evidence[] {
  return candidates.flatMap((candidate) => candidate.evidence).slice(0, 12);
}

export function mergeUnknowns(candidates: Array<{ unknowns: string[] }>, extras: string[] = []): string[] {
  return unique([...extras, ...candidates.flatMap((candidate) => candidate.unknowns)]);
}

export function averageConfidence(
  contextCandidates: Array<{ candidate: DomainContextCandidate }>,
  aggregateCandidates: Array<{ confidence: number }>,
  extraSignals: number[],
): number {
  const signals = [
    ...contextCandidates.map((entry) => entry.candidate.confidence),
    ...aggregateCandidates.map((candidate) => candidate.confidence),
    ...extraSignals,
  ];
  return signals.reduce((sum, signal) => sum + signal, 0) / Math.max(1, signals.length);
}

export function averageLayerConfidence(layers: ArchitectureLayerCandidate[]): number {
  return layers.reduce((sum, layer) => sum + layer.confidence, 0) / Math.max(1, layers.length);
}
