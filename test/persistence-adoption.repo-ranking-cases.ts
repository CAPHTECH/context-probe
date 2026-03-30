import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import { createRankingAdvantageAcceptanceCases } from "./persistence-adoption.repo-ranking-advantage-cases.js";
import { createRankingControlAcceptanceCases } from "./persistence-adoption.repo-ranking-control-cases.js";

export function createRankingAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [...createRankingControlAcceptanceCases(tempRoots), ...createRankingAdvantageAcceptanceCases(tempRoots)];
}
