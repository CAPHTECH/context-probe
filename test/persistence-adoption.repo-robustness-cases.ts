import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import { createMergeOnlyRobustnessAcceptanceCase } from "./persistence-adoption.repo-robustness-merge-only.js";
import { createRenameHeavyRobustnessAcceptanceCase } from "./persistence-adoption.repo-robustness-rename-heavy.js";

export function createRobustnessAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [createRenameHeavyRobustnessAcceptanceCase(tempRoots), createMergeOnlyRobustnessAcceptanceCase(tempRoots)];
}
