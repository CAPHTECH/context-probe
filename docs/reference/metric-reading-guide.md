# Metric Reading Guide

Use this page before reading any specific metric.

This guide explains:

- how to read `score`, `confidence`, and `unknowns`
- when summary metrics are useful
- where formulas and thresholds actually come from
- which document to read next for concept, interpretation, or implementation detail

## Document Roles

The documentation is intentionally split:

- `concepts/`: conceptual model and formulas
- `reference/`: human interpretation
- `implementation/`: current CLI behavior, proxy use, source precedence, and report semantics

Do not use `implementation/` to redefine the meaning of a metric.
Do not use `concepts/` to infer current source precedence or fallback behavior.

## Reading Order

For any metric, read in this order:

1. Concept: what the metric is supposed to measure
2. Reference: how to interpret a high or low value
3. Implementation: how the current CLI actually computes it

## Read `score`, `confidence`, and `unknowns` Separately

### `score`

The arithmetic result computed from the observed inputs.

- `0.0` means high mismatch inside the observed scope
- `1.0` means strong fit inside the observed scope

### `confidence`

How trustworthy the result is.

Low confidence usually means:

- the evidence is thin
- the history is too small
- a proxy or fallback path had to be used
- extraction or normalization left ambiguity behind

### `unknowns`

What the tool could not confirm.

Treat `unknowns` as a first-class part of the result, not as footnotes.
An `ok` run can still have important unknowns.

## Summary Metrics Are Not Standalone Verdicts

Use summary metrics only for:

- comparing candidates inside one product
- before/after comparison in one codebase
- time-series tracking for the same system

Do not use them as organization-wide rankings.

Current summary metrics:

- `DDFI_pre`
- `DDFI_post`
- `APSI`

`APSI` is especially easy to misuse because its current implementation may include proxy or partial supporting inputs.

## Concept vs Current Implementation

Some metrics map directly to the conceptual model.
Others currently rely on proxy, bridge, or partial evidence.

When this distinction matters:

- read [../implementation/domain-design-measurement.md](../implementation/domain-design-measurement.md) for `domain_design`
- read [../implementation/architecture-design-measurement.md](../implementation/architecture-design-measurement.md) for `architecture_design`

## Source of Truth for Formulas and Thresholds

Use these sources in order:

1. Conceptual formulas: `concepts/`
2. Active policy and thresholds: `fixtures/policies/default.yaml` and `src/core/policy.ts`
3. Current analyzer behavior: `implementation/`

If a report and a concept page appear to disagree, trust the implementation page for current behavior and the concept page for intended meaning.

## Recommended Next Documents

- Shared concepts: [../concepts/measurement-model.md](../concepts/measurement-model.md)
- Domain metrics: [domain-design-metrics.md](domain-design-metrics.md)
- Architecture metrics: [architecture-design-metrics.md](architecture-design-metrics.md)
- Runtime and commands: [../implementation/runtime-and-commands.md](../implementation/runtime-and-commands.md)
