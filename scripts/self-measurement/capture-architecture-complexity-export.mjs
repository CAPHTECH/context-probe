#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseRepoRootAndNowArgs,
  normalizeRelativePath,
  readStructuredFile,
  sha256File,
  writeCanonicalYaml,
} from "./architecture-shared.mjs";
import { buildComplexityExportBundle } from "../collectors/architecture/complexity-shared.mjs";

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRepoRoot = path.resolve(scriptDir, "../..");
  const { repoRoot, now } = parseRepoRootAndNowArgs(process.argv.slice(2), defaultRepoRoot);
  const snapshotPath = path.join(repoRoot, "config/self-measurement/architecture-complexity-snapshot.yaml");
  const outputPath = path.join(repoRoot, "config/self-measurement/architecture-complexity-export.yaml");
  const snapshot = await readStructuredFile(snapshotPath);
  const snapshotHash = await sha256File(snapshotPath);
  const relativeSnapshotPath = normalizeRelativePath(repoRoot, snapshotPath);

  const bundle = {
    ...buildComplexityExportBundle(snapshot),
    snapshot: {
      sourceKind: "derived",
      capturedAt: now,
      derivedFrom: {
        path: relativeSnapshotPath,
        sha256: snapshotHash,
      },
    },
  };

  await writeCanonicalYaml(outputPath, bundle);

  process.stdout.write(
    [
      "captured architecture complexity export:",
      `- ${normalizeRelativePath(repoRoot, outputPath)}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
