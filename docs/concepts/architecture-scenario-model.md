# Architecture Scenario Model

## Purpose

This document defines the input shape used to measure `QSF` in architecture-design evaluation.

The goal is to normalize quality scenarios into a calculable structure without losing their decision-making meaning.

## Required Scenario Fields

Each scenario should contain at least:

- `scenarioId`
- `title`
- `stimulus`
- `environment`
- `response`
- `responseMeasure`
- `priority`
- `optimizationDirection`
- `target`
- `worstAcceptable`

## Normalization Rule

For lower-is-better measures:

```text
n_s = clip((worst_s - observed_s) / (worst_s - target_s), 0, 1)
```

For higher-is-better measures:

```text
n_s = clip((observed_s - worst_s) / (target_s - worst_s), 0, 1)
```

Aggregated `QSF`:

```text
QSF = Σ(priority_s * n_s) / Σ(priority_s)
```

## Example Scenario

```yaml
scenarioId: S-001
title: Checkout latency under peak load
stimulus: Customer submits checkout
environment: Peak traffic band
response: System confirms order
responseMeasure:
  name: p95_latency_ms
priority: 10
optimizationDirection: lower_is_better
target: 300
worstAcceptable: 1200
```

## Observation Set

Observed values should be supplied separately from the scenario catalog.

Typical observation fields:

- `scenarioId`
- `observed`
- `observedAt`
- optional source metadata

## Design Rules

1. scenario definitions and observed values are separate artifacts
2. priorities must be explicit
3. targets and worst-acceptable values must both be present
4. raw telemetry should be normalized into scenario observations before QSF calculation
