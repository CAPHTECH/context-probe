# Runtime and Commands

## Purpose

This document describes the runtime pipeline and command model used by the CLI.

The design principle is simple:

- AI handles extraction, candidate generation, and ambiguity surfacing
- deterministic analyzers handle repeatable validation and score computation

## Runtime Pipeline

```text
CLI command
  -> input loading
  -> artifact normalization
  -> optional AI extraction
  -> deterministic analysis
  -> formula evaluation
  -> response assembly
```

## Main Commands

### `score.compute`

Primary entry point for measurement.

Typical responsibilities:

- load policy
- choose domain pack
- load model or constraints
- run analyzers
- compute metrics
- return evidence, confidence, unknowns, diagnostics, and provenance

### `report.generate`

Wraps `score.compute` and renders a Markdown report.

### `gate.evaluate`

Wraps `score.compute` and applies policy thresholds.

### `review.list_unknowns`

Turns unknowns, low-confidence signals, and collisions into review items.

### Document/Trace Commands

- `doc.extract_glossary`
- `doc.extract_rules`
- `doc.extract_invariants`
- `trace.link_terms`
- `trace.link_model_to_code`

These are useful when you need to inspect extracted evidence directly.

## Domain Inputs

### Domain Design

Required:

- `--repo`
- `--model`

Optional:

- `--docs-root`
- extraction backend settings
- policy/profile overrides

### Architecture Design

Required:

- `--repo`
- `--constraints`

Optional:

- scenario catalog and observations
- telemetry inputs
- delivery inputs
- topology model
- boundary map
- complexity sources

## Output Shape

Every command is expected to align to the shared response contract:

- `status`
- `result`
- `evidence`
- `confidence`
- `unknowns`
- `diagnostics`
- `provenance`
- `version`

## Design Rules

1. deterministic analyzers never rely on hidden AI state
2. formulas come from policy, not runtime invention
3. skipped or approximated inputs must surface through `unknowns`
4. source origins must remain visible in `provenance`
5. reporting and gate evaluation are downstream views of the same measured result
