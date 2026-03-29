# Architecture Evidence Lifecycle

## Purpose

This document explains how architecture-design evidence should evolve from greenfield to mature brownfield operation.

## Phase Model

| Phase | Typical Evidence | Main Metrics |
|---|---|---|
| Greenfield | scenario catalog, ADRs, topology draft, static rules, benchmark, chaos test, contract test, estimated CTI | `QSF`, `PCS`, pre-prod `OAS`, `CTI_est` |
| Early Brownfield | code, deploy logs, CI/CD history, initial telemetry, incidents, Git history | `PCS`, `OAS`, `EES`, `CTI` |
| Mature Brownfield | telemetry, SLO/SLI, deploy history, incident trends, cost, on-call data, co-change history | `QSF(actual)`, `OAS`, `EES`, `CTI`, `APSI` |

## Guidance by Metric

### `QSF`

- greenfield: scenario definitions and benchmark estimates
- brownfield: observed scenario values

### `PCS`

- static architecture rules
- dependency checks
- contract-stability checks

### `OAS`

- telemetry by traffic band
- pattern-runtime observations
- topology bridge only as fallback

### `EES`

- delivery observations
- history locality
- boundary maps

### `CTI`

- complexity metadata
- export bundles
- cost and on-call inputs as the system matures

## Operational Rule

Keep the formulas stable where possible and swap the evidence source as the system matures. This makes trend comparison much easier.
