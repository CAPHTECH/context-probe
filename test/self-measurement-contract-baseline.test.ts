import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";
import YAML from "yaml";

import { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const CONSTRAINTS_ENTRY = "config/self-measurement/architecture-constraints.yaml";
const COMPLEXITY_EXPORT_ENTRY = "config/self-measurement/architecture-complexity-export.yaml";
const CONTRACT_BASELINE_ENTRY = "config/self-measurement/architecture-contract-baseline.yaml";
const BOUNDARY_MAP_ENTRY = "config/self-measurement/architecture-boundary-map.yaml";
const SCENARIO_CATALOG_ENTRY = "config/self-measurement/architecture-scenarios.yaml";
const SCENARIO_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-scenario-observations.yaml";
const TOPOLOGY_ENTRY = "config/self-measurement/architecture-topology.yaml";
const RUNTIME_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-runtime-observations.yaml";
const TELEMETRY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-telemetry-observations.yaml";
const PATTERN_RUNTIME_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-pattern-runtime-observations.yaml";
const DELIVERY_OBSERVATIONS_ENTRY = "config/self-measurement/architecture-delivery-observations.yaml";
const PROJECT_ENTRIES = ["src", "config/self-measurement"];

describe("architecture self-measurement contract baseline", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("captures a loadable contract baseline and uses it to remove the IPS proxy unknown", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    await execFile(
      "npm",
      ["run", "--silent", "self:architecture:baseline", "--", "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    const baseline = YAML.parse(await readFile(path.join(repoPath, CONTRACT_BASELINE_ENTRY), "utf8")) as {
      snapshot?: { sourceKind?: string; capturedAt?: string };
      contracts?: Array<{ path: string }>;
    };

    expect(baseline.snapshot).toEqual(
      expect.objectContaining({
        sourceKind: "captured",
        capturedAt: "2026-03-30T00:00:00Z",
      }),
    );
    expect(baseline.contracts?.map((entry) => entry.path)).toEqual(["src/core/contracts.ts"]);

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        constraints: path.join(repoPath, CONSTRAINTS_ENTRY),
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": path.join(repoPath, COMPLEXITY_EXPORT_ENTRY),
        "boundary-map": path.join(repoPath, BOUNDARY_MAP_ENTRY),
        "contract-baseline": path.join(repoPath, CONTRACT_BASELINE_ENTRY),
        "scenario-catalog": path.join(repoPath, SCENARIO_CATALOG_ENTRY),
        "scenario-observations": path.join(repoPath, SCENARIO_OBSERVATIONS_ENTRY),
        "topology-model": path.join(repoPath, TOPOLOGY_ENTRY),
        "runtime-observations": path.join(repoPath, RUNTIME_OBSERVATIONS_ENTRY),
        "telemetry-observations": path.join(repoPath, TELEMETRY_OBSERVATIONS_ENTRY),
        "pattern-runtime-observations": path.join(repoPath, PATTERN_RUNTIME_OBSERVATIONS_ENTRY),
        "delivery-observations": path.join(repoPath, DELIVERY_OBSERVATIONS_ENTRY),
      },
      { cwd: process.cwd() },
    );

    expect(response.status).not.toBe("error");
    expect(response.unknowns).not.toContain(
      "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
    );
  }, 60000);
});
