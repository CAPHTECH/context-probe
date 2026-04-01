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
const MAX_BUFFER = 10 * 1024 * 1024;

function createDomainScoreArgs(repoRoot) {
  return [
    "run",
    "--silent",
    "dev",
    "--",
    "score.compute",
    "--domain",
    "domain_design",
    "--repo",
    repoRoot,
    "--model",
    path.join(repoRoot, "config/self-measurement/domain-model.yaml"),
    "--docs-root",
    path.join(repoRoot, "docs"),
    "--policy",
    "fixtures/policies/default.yaml",
  ];
}

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

async function runJsonCommand(args) {
  const { stdout, stderr } = await execFile("npm", args, {
    cwd: TOOL_ROOT,
    env: process.env,
    maxBuffer: MAX_BUFFER,
  });
  if (stderr) {
    process.stderr.write(stderr);
  }
  return JSON.parse(stdout);
}

function formatMeasurementSummary(response) {
  const quality = response?.meta?.measurementQuality;
  const runtime = response?.meta?.runtime;
  return {
    unknownsCount: quality?.unknownsCount ?? 0,
    proxyRate: quality?.proxyRate ?? 0,
    proxyMetrics: quality?.proxyMetrics ?? [],
    decisionRisk: quality?.decisionRisk ?? "unknown",
    totalMs: runtime?.totalMs ?? null,
  };
}

function writeSummaryLine(domain, summary) {
  const proxyMetrics = summary.proxyMetrics.length > 0 ? summary.proxyMetrics.join(",") : "none";
  const duration = typeof summary.totalMs === "number" ? `${summary.totalMs.toFixed(1)}ms` : "n/a";
  process.stdout.write(
    `${domain} measurement quality: unknowns=${summary.unknownsCount} proxyRate=${summary.proxyRate.toFixed(3)} proxyMetrics=${proxyMetrics} decisionRisk=${summary.decisionRisk} runtime=${duration}\n`,
  );
}

async function main() {
  const { repoRoot } = parseRepoRootAndNowArgs(process.argv.slice(2), TOOL_ROOT);
  const paths = resolveArchitectureSelfMeasurementPaths(repoRoot);

  const domainResponse = await runJsonCommand(createDomainScoreArgs(repoRoot));
  const architectureResponse = await runJsonCommand(createArchitectureScoreArgs(paths, repoRoot));

  writeSummaryLine("domain_design", formatMeasurementSummary(domainResponse));
  writeSummaryLine("architecture_design", formatMeasurementSummary(architectureResponse));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
