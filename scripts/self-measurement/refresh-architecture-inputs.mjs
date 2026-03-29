#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  createArchitectureBenchmarkPlan,
  resolveArchitectureSelfMeasurementPaths,
} from "./architecture-bundle.mjs";
import {
  collectArchitectureSelfMeasurementWarnings,
  deriveBoundaryMap,
  formatSourceDate,
  normalizeRelativePath,
  parseRepoRootAndNowArgs,
  sha256File,
  writeCanonicalJson,
  writeCanonicalYaml,
} from "./architecture-shared.mjs";

const execFile = promisify(execFileCallback);
const MAX_BUFFER = 10 * 1024 * 1024;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.resolve(scriptDir, "../..");
const SCENARIO_COLLECTOR = path.join(TOOL_ROOT, "scripts/collectors/architecture/scenario-actualization-to-qsf.mjs");

async function runExecStep(step, cwd) {
  const startedAt = process.hrtime.bigint();
  await execFile(step.file, step.args, {
    cwd,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
  return Number(elapsedNanoseconds) / 1_000_000_000;
}

async function runShellStep(command, cwd) {
  const startedAt = process.hrtime.bigint();
  await execFile("zsh", ["-lc", command], {
    cwd,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
  return Number(elapsedNanoseconds) / 1_000_000_000;
}

async function measureScenario(planEntry, cwd, sourceDate) {
  const overrideCommand = planEntry.overrideEnvVar ? process.env[planEntry.overrideEnvVar] : undefined;

  let observedSeconds = 0;
  if (overrideCommand) {
    observedSeconds = await runShellStep(overrideCommand, cwd);
  } else if (planEntry.run.kind === "execFile") {
    observedSeconds = await runExecStep(planEntry.run, cwd);
  } else if (planEntry.run.kind === "sequence") {
    for (const step of planEntry.run.steps) {
      observedSeconds += await runExecStep(step, cwd);
    }
  } else {
    throw new Error(`unsupported benchmark step kind: ${planEntry.run.kind}`);
  }

  return {
    scenarioId: planEntry.scenarioId,
    observed: Number(observedSeconds.toFixed(3)),
    source: `local-benchmark-${sourceDate}`,
    note: planEntry.note,
  };
}

async function buildScenarioObservationSet(paths) {
  const { stdout } = await execFile(process.execPath, [SCENARIO_COLLECTOR, paths.scenarioBenchmarkSummary], {
    cwd: TOOL_ROOT,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  return JSON.parse(stdout);
}

async function main() {
  const { repoRoot, now } = parseRepoRootAndNowArgs(process.argv.slice(2), TOOL_ROOT);
  const paths = resolveArchitectureSelfMeasurementPaths(repoRoot);
  const sourceDate = formatSourceDate(now);
  const constraintsHash = await sha256File(paths.constraints);

  const warnings = await collectArchitectureSelfMeasurementWarnings({
    repoRoot,
    nowIsoTimestamp: now,
    paths,
    constraintsHash,
  });

  const derivedBoundaryMap = await deriveBoundaryMap({
    nowIsoTimestamp: now,
    repoRoot,
    paths,
    constraintsHash,
  });
  await writeCanonicalYaml(paths.boundaryMap, derivedBoundaryMap);

  const benchmarkPlan = createArchitectureBenchmarkPlan({ paths, repoRoot });
  const benchmarkObservations = [];
  for (const planEntry of benchmarkPlan) {
    const benchmarkObservation = await measureScenario(planEntry, TOOL_ROOT, sourceDate);
    benchmarkObservations.push(benchmarkObservation);
  }

  const benchmarkSummary = {
    version: "1.0",
    sourceSystem: "benchmark-summary",
    snapshot: {
      sourceKind: "measured",
      capturedAt: now,
    },
    benchmarkSummary: {
      observations: benchmarkObservations,
    },
  };
  await writeCanonicalJson(paths.scenarioBenchmarkSummary, benchmarkSummary);

  const canonicalScenarioObservationSet = await buildScenarioObservationSet(paths);
  await writeCanonicalYaml(paths.scenarioObservations, {
    version: canonicalScenarioObservationSet.version ?? "1.0",
    snapshot: {
      sourceKind: "measured",
      capturedAt: now,
    },
    observations: canonicalScenarioObservationSet.observations,
  });

  for (const warning of warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }

  process.stdout.write(
    [
      "refreshed architecture self-measurement inputs:",
      `- ${normalizeRelativePath(repoRoot, paths.scenarioBenchmarkSummary)}`,
      `- ${normalizeRelativePath(repoRoot, paths.scenarioObservations)}`,
      `- ${normalizeRelativePath(repoRoot, paths.boundaryMap)}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
