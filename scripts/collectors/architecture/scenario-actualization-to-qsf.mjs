#!/usr/bin/env node

import { readStructuredInput, requireInputPath, writeCanonicalJson } from "./common.mjs";

function normalizeObservations(entries, fallbackSource) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    scenarioId: entry.scenarioId,
    observed: entry.observed,
    ...(entry.source ? { source: entry.source } : { source: fallbackSource }),
    ...(entry.note ? { note: entry.note } : {})
  }));
}

async function main() {
  const inputPath = requireInputPath(process.argv);
  const input = await readStructuredInput(inputPath);

  const combined = [
    ...normalizeObservations(input.benchmarkSummary?.observations, "benchmark_summary"),
    ...normalizeObservations(input.incidentReviewSummary?.observations, "incident_review_summary")
  ];

  if (combined.length === 0) {
    throw new Error("scenario actualization input requires benchmarkSummary or incidentReviewSummary observations");
  }

  const deduped = new Map();
  for (const entry of combined) {
    deduped.set(entry.scenarioId, entry);
  }

  writeCanonicalJson({
    version: input.version ?? "1.0",
    observations: Array.from(deduped.values())
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
