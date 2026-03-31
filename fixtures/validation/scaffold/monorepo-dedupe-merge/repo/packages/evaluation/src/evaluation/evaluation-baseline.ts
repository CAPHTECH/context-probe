export interface EvaluationBaseline {
  score: number;
}

export function createEvaluationBaseline(): EvaluationBaseline {
  return { score: 0 };
}
