#!/usr/bin/env node

import {
  readStructuredInput,
  requireInputPath,
  writeCanonicalJson
} from "./common.mjs";
import { buildComplexityExportBundle } from "./complexity-shared.mjs";

async function main() {
  const inputPath = requireInputPath(process.argv);
  const input = await readStructuredInput(inputPath);

  writeCanonicalJson(buildComplexityExportBundle(input));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
