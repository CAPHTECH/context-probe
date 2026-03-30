export function persistenceCandidateToMetricComponents(candidate: {
  persistentCouplingPenalty: number;
  clusterPenalty: number;
  pairPenalty: number;
  coherencePenalty: number;
}): Record<string, number> {
  return {
    persistentCouplingPenalty: candidate.persistentCouplingPenalty,
    clusterPenalty: candidate.clusterPenalty,
    pairPenalty: candidate.pairPenalty,
    coherencePenalty: candidate.coherencePenalty,
  };
}
