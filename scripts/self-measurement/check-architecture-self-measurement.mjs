#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { resolveArchitectureSelfMeasurementPaths } from "./architecture-bundle.mjs";
import { parseRepoRootAndNowArgs } from "./architecture-shared.mjs";

const execFile = promisify(execFileCallback);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.resolve(scriptDir, "../..");
const AUDIT_SCRIPT = path.join(TOOL_ROOT, "scripts/self-measurement/audit-architecture-freshness.mjs");
const MAX_BUFFER = 10 * 1024 * 1024;

function createArchitectureScoreArgs(paths, repoRoot) {
  return [
    "run",
    "--silent",
    "dev",
    "--",
    "score.compute",
    "--domain",
    "architecture_design",
    "--repo",
    repoRoot,
    "--constraints",
    paths.constraints,
    "--complexity-export",
    paths.complexityExport,
    "--boundary-map",
    paths.boundaryMap,
    "--contract-baseline",
    paths.contractBaseline,
    "--scenario-catalog",
    paths.scenarios,
    "--scenario-observations",
    paths.scenarioObservations,
    "--topology-model",
    paths.topology,
    "--runtime-observations",
    paths.runtimeObservations,
    "--telemetry-observations",
    paths.telemetryObservations,
    "--pattern-runtime-observations",
    paths.patternRuntimeObservations,
    "--delivery-observations",
    paths.deliveryObservations,
    "--policy",
    "fixtures/policies/default.yaml",
  ];
}

async function runStep(file, args) {
  const { stdout, stderr } = await execFile(file, args, {
    cwd: TOOL_ROOT,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
}

async function main() {
  const { repoRoot, now } = parseRepoRootAndNowArgs(process.argv.slice(2), TOOL_ROOT);
  const paths = resolveArchitectureSelfMeasurementPaths(repoRoot);

  await runStep(process.execPath, [AUDIT_SCRIPT, "--repo-root", repoRoot, "--now", now]);
  await runStep("npm", createArchitectureScoreArgs(paths, repoRoot));

  process.stdout.write("architecture self-measurement check: ok\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
