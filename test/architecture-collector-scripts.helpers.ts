import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const TELEMETRY_COLLECTOR = path.resolve("scripts/collectors/architecture/telemetry-export-to-oas.mjs");
export const DELIVERY_COLLECTOR = path.resolve("scripts/collectors/architecture/delivery-export-to-ees.mjs");
export const COMPLEXITY_COLLECTOR = path.resolve("scripts/collectors/architecture/complexity-snapshot-to-cti.mjs");
export const SCENARIO_COLLECTOR = path.resolve("scripts/collectors/architecture/scenario-actualization-to-qsf.mjs");

export const COLLECTOR_TELEMETRY_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-good-golden-signals.json",
);
export const COLLECTOR_TELEMETRY_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-bad-golden-signals.json",
);
export const COLLECTOR_TELEMETRY_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-thin-golden-signals.json",
);
export const COLLECTOR_DELIVERY_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/delivery-good-dora.json",
);
export const COLLECTOR_DELIVERY_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/delivery-bad-dora.json",
);
export const COLLECTOR_DELIVERY_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/delivery-thin-dora.json",
);
export const COLLECTOR_COMPLEXITY_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-good-snapshot.json",
);
export const COLLECTOR_COMPLEXITY_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-bad-snapshot.json",
);
export const COLLECTOR_COMPLEXITY_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-thin-snapshot.json",
);
export const COLLECTOR_SCENARIO_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-good-benchmark-summary.json",
);
export const COLLECTOR_SCENARIO_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-bad-benchmark-summary.json",
);
export const COLLECTOR_SCENARIO_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-thin-incident-summary.json",
);

export const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
export const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
export const OAS_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/oas/raw-normalization-profile.yaml");
export const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
export const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
export const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
export const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
export const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
export const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
export const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
export const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
export const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
export const EES_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/ees/raw-normalization-profile.yaml");
export const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";

export async function runCollector(scriptPath: string, inputPath: string) {
  const { stdout } = await execFile(process.execPath, [scriptPath, inputPath], { cwd: process.cwd() });
  return JSON.parse(stdout);
}

export async function writeSourceConfig(tempRoots: string[], fileName: string, payload: unknown): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([]);
  tempRoots.push(tempRoot);
  const targetPath = path.join(tempRoot, fileName);
  await writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
}

export async function materializeGitFixture(
  entry: string,
  tempRoots: string[],
  initialCommitMessage: string,
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([entry]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, entry);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

export async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    const current = await readFile(targetPath, "utf8");
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

export function shellQuote(value: string): string {
  return JSON.stringify(value);
}

export function getMetric(
  response: Awaited<ReturnType<NonNullable<(typeof COMMANDS)["score.compute"]>>>,
  metricId: string,
) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
