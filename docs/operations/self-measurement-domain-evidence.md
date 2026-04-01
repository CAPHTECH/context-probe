# Self-Measurement Domain Evidence

This document states the maintained domain evidence used when `context-probe` measures this repository as a measurement product.

## Core Use Cases

Use case: a maintainer runs `score.compute` for `domain_design` before a release decision. The MeasurementPipeline aggregate must load the maintained domain model, document evidence, and active policy before scoring starts.

Use case: a maintainer runs `report.generate` after one completed score run. The ReportGeneration aggregate must render the same metrics, evidence references, measurement-quality summary, and runtime metadata that the completed run produced.

Use case: a maintainer runs `review.list_unknowns` to decide what evidence to improve next. The ReviewQueue aggregate must keep missing curated inputs, proxy-heavy metrics, low-confidence items, and history hotspots visible in the ordered review queue.

Use case: a maintainer runs `gate.evaluate` in CI before release. The PolicyDecision aggregate must evaluate the scored metrics against the active policy and surface the matching gate reasons.

## Decision Rules

Rule: `score.compute` must return metric outputs, evidence references, confidence, unknowns, provenance, `measurementQuality`, and `runtime` as one consistent scoring result.

Rule: `report.generate` must render the same metric values, guidance, measurement-quality summary, and runtime metadata that the scored result carries.

Rule: `review.list_unknowns` must keep missing curated inputs, proxy-heavy metrics, low-confidence items, and history hotspots ordered ahead of generic unknowns.

Rule: `gate.evaluate` must derive gate status and reasons from the active policy thresholds without changing the scored metric values.

## Aggregate Ownership

The MeasurementPipeline aggregate owns one scoring run for `score.compute`.

The ReportGeneration aggregate owns one rendering run for `report.generate`.

The ReviewQueue aggregate owns one ordered unknown-review queue for `review.list_unknowns`.

The PolicyDecision aggregate owns one gate evaluation for `gate.evaluate`.

## Curated Terms

`Measurement Quality` (`measurementQuality`) is the run-level evidence-quality summary attached to score, report, gate, and review output.

`Runtime Summary` (`runtime`) is the stage-based runtime metadata for one command run.

`Scenario Quality` (`scenarioQuality`) is the curated scenario-health summary for architecture inputs.

`Locality Watchlist` (`localityWatchlist`) is the prioritized cross-boundary co-change watchlist carried into architecture reports and reviews.

## Strong Invariants

Within the MeasurementPipeline aggregate, metric scores and the measurement-quality summary always are consistent.

Within the MeasurementPipeline aggregate, status, confidence, unknowns, and provenance always are consistent.

Within the ReportGeneration aggregate, rendered report sections and their referenced metric outputs always are consistent.

Within the ReviewQueue aggregate, review ordering and the rendered action categories always are consistent.

Within the PolicyDecision aggregate, gate status and gate reasons always are consistent.
