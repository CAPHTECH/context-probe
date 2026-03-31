# Architecture Source Collectors

## Purpose

This document describes how canonical source configs and export bundles feed architecture metrics.

## Collector Families

### `OAS`

Goal:

- convert telemetry into canonical traffic-band observations
- optionally ingest pattern-runtime observations

### `EES`

Goal:

- convert delivery data into canonical delivery observations

### `CTI`

Goal:

- convert complexity snapshots into canonical complexity metadata
- repo-local self-measurement keeps a curated raw snapshot at `config/self-measurement/architecture-complexity-snapshot.yaml`
- `npm run self:architecture:complexity` regenerates `architecture-complexity-export.yaml` from that snapshot

### `QSF`

Goal:

- convert benchmark and incident evidence into canonical scenario observations
- keep authored scenario observations separate from scaffold templates; scaffold only provides a review-only `scenarioObservationsTemplate`

### `IPS`

Goal:

- capture or provide a canonical contract baseline snapshot for `CBC` / `BCR` deltas

## Input Precedence

Typical precedence is:

- explicit observation input
- raw observations + normalization profile
- export bundle
- source config

`IPS` uses a smaller precedence rule:

- explicit `contract-baseline`
- `contract-baseline-source`
- otherwise baseline-free heuristic scoring

If a higher-priority source is present, lower-priority sources should be ignored and surfaced through `unknowns`.

## Operating Rule

Keep vendor-specific collectors outside the scoring core. The scoring core should consume canonical inputs, not vendor APIs directly.

The example contract baseline source lives at [fixtures/examples/architecture-sources/contract-baseline-source.file.yaml](../../fixtures/examples/architecture-sources/contract-baseline-source.file.yaml).
