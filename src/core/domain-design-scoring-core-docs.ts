export function buildDomainDocsMetricFormulas(policy: {
  metrics: Record<string, { formula: string } | undefined>;
}): Partial<Record<"DRF" | "ULI" | "BFS" | "AFS", string>> {
  return {
    ...(policy.metrics.DRF ? { DRF: policy.metrics.DRF.formula } : {}),
    ...(policy.metrics.ULI ? { ULI: policy.metrics.ULI.formula } : {}),
    ...(policy.metrics.BFS ? { BFS: policy.metrics.BFS.formula } : {}),
    ...(policy.metrics.AFS ? { AFS: policy.metrics.AFS.formula } : {}),
  };
}
