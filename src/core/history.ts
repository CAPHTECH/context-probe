import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import type { CochangeAnalysis, CochangeCommit, DomainModel, PolicyConfig } from "./contracts.js";
import { matchGlobs, toPosixPath } from "./io.js";

const execFile = promisify(execFileCallback);

function classifyContext(filePath: string, model: DomainModel): string | undefined {
  return model.contexts.find((context) => matchGlobs(filePath, context.pathGlobs))?.name;
}

export async function normalizeHistory(
  repoPath: string,
  policyConfig: PolicyConfig,
  profileName: string
): Promise<CochangeCommit[]> {
  const profile = policyConfig.profiles[profileName];
  const ignoreCommitPatterns = (profile?.history_filters?.ignore_commit_patterns ?? []).map(
    (pattern) => new RegExp(pattern)
  );
  const ignorePaths = profile?.history_filters?.ignore_paths ?? [];

  const { stdout } = await execFile(
    "git",
    ["-C", repoPath, "log", "--name-only", "--pretty=format:__COMMIT__%n%H%n%s"],
    {
      cwd: repoPath
    }
  );

  const commits: CochangeCommit[] = [];
  const blocks = stdout.split("__COMMIT__\n").map((block) => block.trim()).filter(Boolean);

  for (const block of blocks) {
    const [hash, subject = "", ...files] = block.split("\n");
    if (!hash) {
      continue;
    }
    if (ignoreCommitPatterns.some((pattern) => pattern.test(subject))) {
      continue;
    }
    const normalizedFiles = files
      .map((entry) => toPosixPath(entry.trim()))
      .filter(Boolean)
      .filter((entry) => !ignorePaths.includes(entry));

    if (normalizedFiles.length === 0) {
      continue;
    }

    commits.push({
      hash,
      subject,
      files: normalizedFiles
    });
  }

  return commits;
}

export function scoreEvolutionLocality(
  commits: CochangeCommit[],
  model: DomainModel
): CochangeAnalysis {
  const relevant = commits
    .map((commit) => {
      const contexts = new Set(
        commit.files
          .map((filePath) => classifyContext(filePath, model))
          .filter((value): value is string => Boolean(value))
      );
      return {
        ...commit,
        contexts
      };
    })
    .filter((entry) => entry.contexts.size > 0);

  if (relevant.length === 0) {
    return {
      commits: [],
      crossContextCommits: 0,
      localCommits: 0,
      averageContextsPerCommit: 0,
      surpriseCouplingRatio: 0,
      crossContextChangeLocality: 0,
      featureScatter: 0,
      contextsSeen: []
    };
  }

  const crossContextCommits = relevant.filter((entry) => entry.contexts.size > 1).length;
  const localCommits = relevant.length - crossContextCommits;
  const totalContextTouches = relevant.reduce((sum, entry) => sum + entry.contexts.size, 0);
  const averageContextsPerCommit = totalContextTouches / relevant.length;
  const contextsSeen = Array.from(new Set(relevant.flatMap((entry) => Array.from(entry.contexts)))).sort();
  const maxContexts = Math.max(1, contextsSeen.length);
  const featureScatter =
    maxContexts <= 1 ? 0 : Math.min(1, (averageContextsPerCommit - 1) / (maxContexts - 1));
  const surpriseCouplingRatio = crossContextCommits / relevant.length;
  const crossContextChangeLocality = localCommits / relevant.length;

  return {
    commits,
    crossContextCommits,
    localCommits,
    averageContextsPerCommit,
    surpriseCouplingRatio,
    crossContextChangeLocality,
    featureScatter,
    contextsSeen
  };
}
