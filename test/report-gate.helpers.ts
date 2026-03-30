export function metric(input: {
  metricId: string;
  value: number;
  confidence?: number;
  components?: Record<string, number>;
  unknowns?: string[];
}): {
  metricId: string;
  value: number;
  components: Record<string, number>;
  confidence: number;
  evidenceRefs: string[];
  unknowns: string[];
} {
  return {
    metricId: input.metricId,
    value: input.value,
    components: input.components ?? {},
    confidence: input.confidence ?? 0.9,
    evidenceRefs: [],
    unknowns: input.unknowns ?? [],
  };
}
