#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveArchitectureSelfMeasurementPaths } from "./architecture-bundle.mjs";
import {
  collectArchitectureSelfMeasurementWarnings,
  parseRepoRootAndNowArgs,
  sha256File,
} from "./architecture-shared.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.resolve(scriptDir, "../..");

function emitWarning(message) {
  if (process.env.GITHUB_ACTIONS === "true") {
    process.stderr.write(`::warning::${message}\n`);
    return;
  }
  process.stderr.write(`warning: ${message}\n`);
}

async function main() {
  const { repoRoot, now } = parseRepoRootAndNowArgs(process.argv.slice(2), TOOL_ROOT);
  const paths = resolveArchitectureSelfMeasurementPaths(repoRoot);
  const constraintsHash = await sha256File(paths.constraints);
  const warnings = await collectArchitectureSelfMeasurementWarnings({
    repoRoot,
    nowIsoTimestamp: now,
    paths,
    constraintsHash,
  });

  if (warnings.length === 0) {
    process.stdout.write("architecture self-measurement freshness: no warnings\n");
    return;
  }

  for (const warning of warnings) {
    emitWarning(warning);
  }
  process.stdout.write(`architecture self-measurement freshness: ${warnings.length} warning(s)\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
