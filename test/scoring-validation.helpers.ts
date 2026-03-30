import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
export const CODEX_STUB = path.resolve("test/fixtures/stubs/codex-stub.mjs");
export const DATA_FILE_STUB = path.resolve("test/fixtures/stubs/emit-data-file.mjs");
export const MCCS_MODEL_PATH = path.resolve("fixtures/validation/scoring/mccs/model.yaml");
export const MCCS_GOOD_ENTRY = "fixtures/validation/scoring/mccs/good-repo";
export const MCCS_BAD_ENTRY = "fixtures/validation/scoring/mccs/bad-repo";
export const DDS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/dds/constraints.yaml");
export const DDS_GOOD_REPO = path.resolve("fixtures/validation/scoring/dds/good-repo");
export const DDS_BAD_REPO = path.resolve("fixtures/validation/scoring/dds/bad-repo");
export const BPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/bps/constraints.yaml");
export const BPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/bps/good-repo");
export const BPS_BAD_REPO = path.resolve("fixtures/validation/scoring/bps/bad-repo");
export const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
export const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
export const IPS_BAD_REPO = path.resolve("fixtures/validation/scoring/ips/bad-repo");
export const IPS_BASELINE_PATH = path.resolve("fixtures/examples/architecture-sources/contract-baseline.yaml");
export const IPS_BASELINE_SOURCE_FILE_PATH = path.resolve(
  "fixtures/examples/architecture-sources/contract-baseline-source.file.yaml",
);
export const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
export const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
export const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
export const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
export const CTI_GOOD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-good-complexity.yaml");
export const CTI_BAD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-bad-complexity.yaml");
export const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
export const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
export const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
export const QSF_GOOD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/good-observations.yaml");
export const QSF_BAD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/bad-observations.yaml");
export const QSF_THIN_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/thin-observations.yaml");
export const APSI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/good-constraints.yaml");
export const APSI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/bad-constraints.yaml");
export const APSI_FORMULAS = {
  default: { QSF: 0.3, PCS: 0.2, OAS: 0.2, EES: 0.15, CTI: 0.15 },
  layered: { QSF: 0.35, PCS: 0.3, OAS: 0.15, EES: 0.1, CTI: 0.1 },
  service_based: { QSF: 0.2, PCS: 0.2, OAS: 0.15, EES: 0.25, CTI: 0.2 },
  cqrs: { QSF: 0.3, PCS: 0.15, OAS: 0.25, EES: 0.1, CTI: 0.2 },
  event_driven: { QSF: 0.2, PCS: 0.15, OAS: 0.3, EES: 0.1, CTI: 0.25 },
} as const;
export const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
export const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
export const TIS_GOOD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/good-topology.yaml");
export const TIS_BAD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/bad-topology.yaml");
export const TIS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/good-runtime.yaml");
export const TIS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/bad-runtime.yaml");
export const OAS_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/good-telemetry.yaml");
export const OAS_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/bad-telemetry.yaml");
export const OAS_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/thin-telemetry.yaml");
export const OAS_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/oas/raw-normalization-profile.yaml");
export const OAS_RAW_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-good-telemetry.yaml");
export const OAS_RAW_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-bad-telemetry.yaml");
export const OAS_RAW_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-thin-telemetry.yaml");
export const OAS_EXPORT_GOOD_TELEMETRY_PATH = path.resolve(
  "fixtures/validation/scoring/oas/export-good-telemetry.yaml",
);
export const OAS_EXPORT_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/export-bad-telemetry.yaml");
export const OAS_EXPORT_THIN_TELEMETRY_PATH = path.resolve(
  "fixtures/validation/scoring/oas/export-thin-telemetry.yaml",
);
export const OAS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/good-runtime.yaml");
export const OAS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/bad-runtime.yaml");
export const OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-good-runtime.yaml",
);
export const OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-bad-runtime.yaml",
);
export const OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-good-runtime.yaml",
);
export const OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-bad-runtime.yaml",
);
export const OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-good-runtime.yaml",
);
export const OAS_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-bad-runtime.yaml",
);
export const OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-good-runtime.yaml",
);
export const OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-bad-runtime.yaml",
);
export const OAS_FAMILY_THIN_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/family-thin-runtime.yaml");
export const OAS_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-mismatch-runtime.yaml",
);
export const OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-pattern-runtime-normalization-profile.yaml",
);
export const OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_THIN_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-thin-runtime.yaml",
);
export const OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-mismatch-runtime.yaml",
);
export const AELS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/aels/constraints.yaml");
export const AELS_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/aels/boundary-map.yaml");
export const AELS_BASE_ENTRY = "fixtures/validation/scoring/aels/base-repo";
export const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
export const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
export const EES_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/good-delivery.yaml");
export const EES_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/bad-delivery.yaml");
export const EES_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/ees/raw-normalization-profile.yaml");
export const EES_RAW_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-good-delivery.yaml");
export const EES_RAW_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-bad-delivery.yaml");
export const EES_RAW_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-thin-delivery.yaml");
export const EES_EXPORT_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-good-delivery.yaml");
export const EES_EXPORT_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-bad-delivery.yaml");
export const EES_EXPORT_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-thin-delivery.yaml");
export const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";
export const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
export const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";
export const BFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/bfs/model.yaml");
export const BFS_GOOD_ENTRY = "fixtures/validation/scoring/bfs/good";
export const BFS_BAD_ENTRY = "fixtures/validation/scoring/bfs/bad-misaligned";
export const AFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/afs/model.yaml");
export const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";
export const AFS_BAD_ENTRY = "fixtures/validation/scoring/afs/bad-cross-transaction";
export const DRF_MODEL_PATH = path.resolve("fixtures/validation/scoring/drf/model.yaml");
export const DRF_GOOD_ENTRY = "fixtures/validation/scoring/drf/good";
export const DRF_BAD_ENTRY = "fixtures/validation/scoring/drf/bad-ambiguous";
export const ULI_MODEL_PATH = path.resolve("fixtures/validation/scoring/uli/model.yaml");
export const ULI_GOOD_ENTRY = "fixtures/validation/scoring/uli/good";
export const ULI_BAD_TRACE_ENTRY = "fixtures/validation/scoring/uli/bad-trace";

export async function cleanupValidationTempRoots(tempRoots: string[]): Promise<void> {
  await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
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

export async function renameAndCommit(
  repoPath: string,
  fromPath: string,
  toPath: string,
  message: string,
): Promise<void> {
  await execFile("git", ["mv", fromPath, toPath], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

export async function commitOnBranchAndMerge(
  repoPath: string,
  branchName: string,
  updates: Record<string, string>,
  commitMessage: string,
  mergeMessage: string,
): Promise<void> {
  const { stdout } = await execFile("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoPath });
  const baseBranch = stdout.trim();

  await execFile("git", ["checkout", "-b", branchName], { cwd: repoPath });
  await appendAndCommit(repoPath, updates, commitMessage);
  await execFile("git", ["checkout", baseBranch], { cwd: repoPath });
  await execFile(
    "git",
    [
      "-c",
      "user.email=tester@example.com",
      "-c",
      "user.name=Context Probe Tester",
      "merge",
      "--no-ff",
      branchName,
      "-m",
      mergeMessage,
    ],
    { cwd: repoPath },
  );
}

export async function writeJsonFixture<T>(tempRoots: string[], fileName: string, payload: T): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([]);
  tempRoots.push(tempRoot);
  const targetPath = path.join(tempRoot, fileName);
  await writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
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

export function getLocalityComparison(
  response: Awaited<ReturnType<NonNullable<(typeof COMMANDS)["history.compare_locality_models"]>>>,
) {
  return response.result as {
    els: {
      score: number;
      components: {
        CCL: number;
        FS: number;
        SCR: number;
      };
    };
    persistenceCandidate: {
      localityScore: number;
      persistentCouplingPenalty: number;
    };
    persistenceAnalysis: {
      pairWeights: Array<{ left: string; right: string; rawCount: number; jaccard: number }>;
      noiseRatio: number;
    };
    delta: number;
  };
}

export function computeApsiFromWeights(
  components: Record<string, number>,
  weights: { QSF: number; PCS: number; OAS: number; EES: number; CTI: number },
): number {
  return (
    weights.QSF * (components.QSF ?? 0.5) +
    weights.PCS * (components.PCS ?? 0.5) +
    weights.OAS * (components.OAS ?? 0.5) +
    weights.EES * (components.EES ?? 0.5) +
    weights.CTI * (1 - (components.CTI ?? 0.5))
  );
}
