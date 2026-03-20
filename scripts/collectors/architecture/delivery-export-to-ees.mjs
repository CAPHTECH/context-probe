#!/usr/bin/env node

import {
  pickDefinedEntries,
  readStructuredInput,
  requireInputPath,
  writeCanonicalJson
} from "./common.mjs";

async function main() {
  const inputPath = requireInputPath(process.argv);
  const input = await readStructuredInput(inputPath);

  if (!input.dora) {
    throw new Error("delivery collector input requires dora");
  }

  const output = {
    version: input.version ?? "1.0",
    ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
    measurements: pickDefinedEntries([
      ["leadTime", input.dora.leadTime],
      ["deployFrequency", input.dora.deployFrequency],
      ["recoveryTime", input.dora.recoveryTime],
      ["changeFailRate", input.dora.changeFailRate],
      ["reworkRate", input.dora.reworkRate]
    ]),
    ...(input.note ? { note: input.note } : {})
  };

  writeCanonicalJson(output);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
