# Shared Measurement Model

## Purpose

This document defines the measurement model shared by both domain-design and architecture-design evaluation. The goal is to keep evidence handling, score calculation, and review workflow stable as new evaluation areas are added.

## Structure

The platform consists of:

- a shared foundation
- one or more evaluation packs

### Shared Foundation

- artifact ingestion
- normalization
- provenance attachment
- evidence handling
- score calculation engine
- review queue
- reporting, CI, and baseline comparison

### Evaluation Pack

Each pack defines:

| Element | Meaning |
|---|---|
| `artifact_profile` | required artifacts |
| `extractors` | AI-assisted extraction |
| `deterministic_analyzers` | deterministic validation |
| `metric_definitions` | formulas, components, thresholds |
| `review_rules` | mandatory review conditions |
| `report_views` | dashboard/report grouping |

## Lifecycle

All packs follow the same lifecycle:

1. `ingest`
2. `normalize`
3. `extract`
4. `analyze`
5. `score`
6. `review`
7. `report`

## Scoring Model

### Scores are normalized to `0.0..1.0`

- `0.0` means high mismatch within the observed scope
- `1.0` means strong fit within the observed scope

### Formulas are declarative

- formulas live in policy/config
- AI does not invent weights at runtime
- comparisons remain explainable

### `confidence` is not `score`

- `score`: arithmetic result from observed evidence
- `confidence`: how complete and trustworthy that evidence is

A high score with low confidence is still a review concern.

## Comparison Units

Supported comparison modes:

- current-state evaluation
- candidate comparison
- baseline comparison
- PR diff
- time-series comparison

## Review Model

Items enter the review queue when:

- `confidence < threshold`
- `unknowns_count > 0`
- there is collision or classification ambiguity
- a pack-specific high-risk condition is met

Review can return:

- approve
- modify
- hold
- out of scope

## Minimum Evaluation-Pack Interface

```yaml
domain_pack:
  id: domain_design
  version: 0.1
  inputs:
    required:
      - documents
      - repository
    optional:
      - issues
      - adrs
  extractors:
    - doc.extract_glossary
    - doc.extract_rules
  analyzers:
    - code.detect_dependencies
    - history.mine_cochange
  metrics:
    - ULI
    - MCCS
    - ELS
  review_rules:
    - "confidence < 0.75"
    - "unknowns_count > 0"
```

## Shared Output Contract

All commands return at least:

```json
{
  "status": "ok",
  "result": {},
  "evidence": [],
  "confidence": 0.0,
  "unknowns": [],
  "diagnostics": [],
  "provenance": [],
  "version": "1.0"
}
```

## Initial Evaluation Catalog

| Area | Implementation Focus | Main Metrics |
|---|---|---|
| Domain Design | first implementation | `DRF`, `ULI`, `BFS`, `AFS`, `MCCS`, `ELS` |
| Architecture Design | next expansion | `QSF`, `DDS`, `BPS`, `IPS`, `TIS`, `AELS`, `OAS`, `CTI`, `EES`, `APSI` |

## Extension Rules

Every new evaluation area must:

1. follow the shared output contract
2. state what is AI-extracted vs deterministic
3. express formulas through configuration
4. return `confidence` and `unknowns`
5. define mandatory review conditions
