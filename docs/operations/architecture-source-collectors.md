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

### `QSF`

Goal:

- convert benchmark and incident evidence into canonical scenario observations

## Input Precedence

Typical precedence is:

- explicit observation input
- raw observations + normalization profile
- export bundle
- source config

If a higher-priority source is present, lower-priority sources should be ignored and surfaced through `unknowns`.

## Operating Rule

Keep vendor-specific collectors outside the scoring core. The scoring core should consume canonical inputs, not vendor APIs directly.
