export interface EvaluationReview {
  score: number;
}

export function createEvaluationReview(): EvaluationReview {
  return { score: 1 };
}
