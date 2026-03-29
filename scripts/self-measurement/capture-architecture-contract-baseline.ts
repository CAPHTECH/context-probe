#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { captureInterfaceProtocolBaseline } from "../../src/analyzers/architecture-contracts.js";
import { parseCodebase } from "../../src/analyzers/code.js";
import { loadArchitectureConstraints } from "../../src/core/model.js";

function parseArgs(argv: string[], defaultRepoRoot: string): { repoRoot: string; now: string } {
  const args = {
    repoRoot: defaultRepoRoot,
    now: new Date().toISOString(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo-root") {
      args.repoRoot = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--now") {
      args.now = argv[index + 1] ?? "";
      index += 1;
    }
  }

  if (!args.repoRoot) {
    throw new Error("--repo-root requires a value");
  }
  if (!Number.isFinite(Date.parse(args.now))) {
    throw new Error(`--now must be a valid ISO-8601 timestamp: ${args.now}`);
  }

  return args;
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRepoRoot = path.resolve(scriptDir, "../..");
  const { repoRoot, now } = parseArgs(process.argv.slice(2), defaultRepoRoot);
  const constraintsPath = path.join(repoRoot, "config/self-measurement/architecture-constraints.yaml");
  const outputPath = path.join(repoRoot, "config/self-measurement/architecture-contract-baseline.yaml");
  const constraints = await loadArchitectureConstraints(constraintsPath);
  const codebase = await parseCodebase(repoRoot);
  const baseline = await captureInterfaceProtocolBaseline({
    root: repoRoot,
    codebase,
    constraints,
    capturedAt: now,
    note: "Captured from the current contract surface for IPS baseline comparison.",
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, YAML.stringify(baseline, null, { lineWidth: 0 }), "utf8");

  process.stdout.write(
    [
      "captured architecture contract baseline:",
      `- ${path.relative(repoRoot, outputPath).split(path.sep).join("/")}`,
    ].join("\n") + "\n",
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
