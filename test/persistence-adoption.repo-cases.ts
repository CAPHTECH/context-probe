import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import { createInvariantAcceptanceCases } from "./persistence-adoption.repo-invariants-cases.js";
import { createRankingAcceptanceCases } from "./persistence-adoption.repo-ranking-cases.js";
import { createRobustnessAcceptanceCases } from "./persistence-adoption.repo-robustness-cases.js";

export function createAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    ...createRankingAcceptanceCases(tempRoots),
    ...createRobustnessAcceptanceCases(tempRoots),
    ...createInvariantAcceptanceCases(tempRoots),
  ];
}
