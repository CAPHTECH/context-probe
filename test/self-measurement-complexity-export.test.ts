import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";
import YAML from "yaml";

import { cleanupTemporaryRepo, createTemporaryWorkspace } from "./helpers.js";

const execFile = promisify(execFileCallback);

const CAPTURE_SCRIPT_PATH = path.resolve("scripts/self-measurement/capture-architecture-complexity-export.mjs");
const PROJECT_ENTRIES = ["src", "config/self-measurement"];

describe("architecture self-measurement complexity export capture", () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupTemporaryRepo(repoPath);
      repoPath = undefined;
    }
  });

  test("captures a derived complexity export from the curated complexity snapshot", async () => {
    repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);

    const snapshotPath = path.join(repoPath, "config/self-measurement/architecture-complexity-snapshot.yaml");
    const snapshot = YAML.parse(await readFile(snapshotPath, "utf8")) as {
      team?: { count?: number };
      finance?: { runCostPerBusinessTransaction?: number };
    };
    snapshot.team = {
      count: 2,
    };
    snapshot.finance = {
      runCostPerBusinessTransaction: 0.25,
    };
    await writeFile(snapshotPath, YAML.stringify(snapshot), "utf8");

    const { stdout } = await execFile(
      process.execPath,
      [CAPTURE_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"],
      {
        cwd: process.cwd(),
      },
    );

    const exportPath = path.join(repoPath, "config/self-measurement/architecture-complexity-export.yaml");
    const complexityExport = YAML.parse(await readFile(exportPath, "utf8")) as {
      snapshot?: {
        sourceKind?: string;
        capturedAt?: string;
        derivedFrom?: { path?: string; sha256?: string };
      };
      metrics?: {
        teamCount?: number;
        runCostPerBusinessTransaction?: number;
      };
    };

    expect(stdout).toContain("captured architecture complexity export:");
    expect(complexityExport.snapshot?.sourceKind).toBe("derived");
    expect(complexityExport.snapshot?.capturedAt).toBe("2026-03-30T00:00:00Z");
    expect(complexityExport.snapshot?.derivedFrom?.path).toBe(
      "config/self-measurement/architecture-complexity-snapshot.yaml",
    );
    expect(complexityExport.snapshot?.derivedFrom?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(complexityExport.metrics?.teamCount).toBe(2);
    expect(complexityExport.metrics?.runCostPerBusinessTransaction).toBe(0.25);
  });
});
