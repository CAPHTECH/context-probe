import { cleanupTemporaryRepo } from "./helpers.js";

const TIE_TOLERANCE = 0.02;

export async function cleanupPersistenceTempRoots(tempRoots: string[]): Promise<void> {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await cleanupTemporaryRepo(root);
    }
  }
}

export function scoresPreferBetter(better: number, worse: number): boolean {
  return better - worse > TIE_TOLERANCE;
}

export function summarizeAdvantages(results: Array<{ elsCorrect: boolean; persistenceCorrect: boolean }>) {
  const caseCount = results.length;
  const elsMisclassifications = results.filter((entry) => !entry.elsCorrect).length;
  const persistenceMisclassifications = results.filter((entry) => !entry.persistenceCorrect).length;
  const improvementRate =
    elsMisclassifications === 0 ? 0 : (elsMisclassifications - persistenceMisclassifications) / elsMisclassifications;

  return {
    caseCount,
    elsMisclassifications,
    persistenceMisclassifications,
    improvementRate,
  };
}
