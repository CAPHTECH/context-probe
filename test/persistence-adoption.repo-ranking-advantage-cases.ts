import type { AcceptanceCase } from "./persistence-adoption.helpers.js";
import {
  applyPartiallyConcentratedPattern,
  applyRotatingPairPattern,
  applyStablePairPattern,
  applySupportLocalityBaseline,
  buildThreeContextRepo,
  compareLocality,
} from "./persistence-adoption.repo-helpers.js";
import {
  compareCommits,
  partiallyConcentratedCommits,
  rotatingPairCommits,
  stablePairCommits,
} from "./persistence-adoption.synthetic-cases.js";

export function createRankingAdvantageAcceptanceCases(tempRoots: string[]): AcceptanceCase[] {
  return [
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "rotating-pairs-vs-stable-pair",
      build: async () => ({
        better: compareCommits(rotatingPairCommits()).result,
        worse: compareCommits(stablePairCommits()).result,
      }),
    },
    {
      kind: "advantage",
      evidenceLevel: "synthetic",
      id: "partially-concentrated-vs-stable-pair",
      build: async () => ({
        better: compareCommits(partiallyConcentratedCommits()).result,
        worse: compareCommits(stablePairCommits()).result,
      }),
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-rotating-pairs-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable pair repo");
        const rotating = await buildThreeContextRepo(tempRoots, "feat: init rotating pair repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(rotating.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable");
        await applyRotatingPairPattern(rotating.repoPath, "rotating");

        return {
          better: (await compareLocality(rotating.repoPath, rotating.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result,
        };
      },
    },
    {
      kind: "advantage",
      evidenceLevel: "repo_backed",
      id: "repo-backed-partially-concentrated-vs-stable-pair",
      build: async () => {
        const stable = await buildThreeContextRepo(tempRoots, "feat: init stable partial repo");
        const partial = await buildThreeContextRepo(tempRoots, "feat: init partial concentration repo");

        await applySupportLocalityBaseline(stable.repoPath);
        await applySupportLocalityBaseline(partial.repoPath);
        await applyStablePairPattern(stable.repoPath, "stable-partial");
        await applyPartiallyConcentratedPattern(partial.repoPath, "partial");

        return {
          better: (await compareLocality(partial.repoPath, partial.modelPath)).result,
          worse: (await compareLocality(stable.repoPath, stable.modelPath)).result,
        };
      },
    },
  ];
}
