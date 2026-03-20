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

  const deployableCount = input.platform?.deployableCount;
  const explicitPipelineCount = input.platform?.pipelineCount;
  const pipelinesPerDeployable = input.platform?.pipelinesPerDeployable;
  const computedPipelineCount =
    explicitPipelineCount !== undefined
      ? explicitPipelineCount
      : deployableCount !== undefined && pipelinesPerDeployable !== undefined
        ? deployableCount * pipelinesPerDeployable
        : undefined;

  const output = {
    version: input.version ?? "1.0",
    ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
    metrics: pickDefinedEntries([
      ["teamCount", input.team?.count],
      ["deployableCount", deployableCount],
      ["pipelineCount", computedPipelineCount],
      ["contractOrSchemaCount", input.architecture?.contractOrSchemaCount],
      ["serviceCount", input.architecture?.serviceCount],
      ["serviceGroupCount", input.architecture?.serviceGroupCount],
      ["datastoreCount", input.platform?.datastoreCount],
      ["onCallSurface", input.platform?.onCallSurface],
      ["syncDepthP95", input.platform?.syncDepthP95],
      ["runCostPerBusinessTransaction", input.finance?.runCostPerBusinessTransaction]
    ]),
    ...(input.note ? { note: input.note } : {})
  };

  writeCanonicalJson(output);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
