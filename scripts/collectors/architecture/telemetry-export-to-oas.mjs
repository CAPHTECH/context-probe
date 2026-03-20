#!/usr/bin/env node

import {
  pickDefinedEntries,
  readStructuredInput,
  requireInputPath,
  writeCanonicalJson
} from "./common.mjs";

function mapPatternRuntime(patternRuntime) {
  if (!patternRuntime) {
    return undefined;
  }

  const mapped = {
    version: patternRuntime.version ?? "1.0",
    ...(patternRuntime.family ? { patternFamily: patternRuntime.family } : {}),
    ...(patternRuntime.source ? { source: patternRuntime.source } : {}),
    ...(patternRuntime.note ? { note: patternRuntime.note } : {}),
    ...(patternRuntime.layered
      ? {
          layeredRuntime: pickDefinedEntries([
            ["FailureContainmentScore", patternRuntime.layered.failureContainmentScore],
            ["DependencyIsolationScore", patternRuntime.layered.dependencyIsolationScore]
          ])
        }
      : {}),
    ...(patternRuntime.serviceBased
      ? {
          serviceBasedRuntime: pickDefinedEntries([
            ["PartialFailureContainmentScore", patternRuntime.serviceBased.partialFailureContainmentScore],
            ["RetryAmplificationScore", patternRuntime.serviceBased.retryAmplificationScore],
            ["SyncHopDepthScore", patternRuntime.serviceBased.syncHopDepthScore]
          ])
        }
      : {}),
    ...(patternRuntime.cqrs
      ? {
          cqrsRuntime: pickDefinedEntries([
            ["ProjectionFreshnessScore", patternRuntime.cqrs.projectionFreshnessScore],
            ["ReplayDivergenceScore", patternRuntime.cqrs.replayDivergenceScore],
            ["StaleReadAcceptabilityScore", patternRuntime.cqrs.staleReadAcceptabilityScore]
          ])
        }
      : {}),
    ...(patternRuntime.eventDriven
      ? {
          eventDrivenRuntime: pickDefinedEntries([
            ["DeadLetterHealthScore", patternRuntime.eventDriven.deadLetterHealthScore],
            ["ConsumerLagScore", patternRuntime.eventDriven.consumerLagScore],
            ["ReplayRecoveryScore", patternRuntime.eventDriven.replayRecoveryScore]
          ])
        }
      : {}),
    ...(patternRuntime.score !== undefined ? { score: patternRuntime.score } : {}),
    ...(patternRuntime.metrics ? { metrics: patternRuntime.metrics } : {})
  };

  return mapped;
}

async function main() {
  const inputPath = requireInputPath(process.argv);
  const input = await readStructuredInput(inputPath);

  if (!Array.isArray(input.trafficBands)) {
    throw new Error("telemetry collector input requires trafficBands");
  }

  const output = {
    version: input.version ?? "1.0",
    ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
    bands: input.trafficBands.map((band) => ({
      bandId: band.id,
      trafficWeight: band.weight,
      ...pickDefinedEntries([
        ["latencyP95", band.latencyP95Ms],
        ["errorRate", band.errorRate],
        ["saturationRatio", band.saturationRatio],
        ["window", band.window]
      ])
    })),
    ...(input.patternRuntime ? { patternRuntime: mapPatternRuntime(input.patternRuntime) } : {}),
    ...(input.note ? { note: input.note } : {})
  };

  writeCanonicalJson(output);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
