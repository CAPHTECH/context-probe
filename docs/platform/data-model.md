# Data Model

## Purpose

This document defines the standard data structures shared across commands and evaluation packs.

## Core Concepts

### Artifact

Represents an ingested file or other source unit.

Typical fields:

- `artifactId`
- `type`
- `path`
- `size`
- `hash`
- `collectedAt`

### Fragment

Represents a normalized chunk of a document or source file.

Typical fields:

- `fragmentId`
- `artifactId`
- `kind`
- `text`
- `path`
- `lineStart`
- `lineEnd`

### Evidence

Represents the traceable reason for a finding or score component.

Typical fields:

- `evidenceId`
- `type`
- `statement`
- `confidence`
- `linkedEntities`
- `source`

### MetricScore

Represents one metric result.

Typical fields:

- `metricId`
- `value`
- `components`
- `confidence`
- `evidenceRefs`
- `unknowns`

### ProvenanceRef

Points back to where an input came from.

Typical fields:

- `path`
- `note`
- optional `line`

## Command Response

All commands use the same envelope:

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

## Domain-Design Result Pattern

Typical result fields:

- `domainId`
- `metrics`
- `leakFindings`
- `history`
- `crossContextReferences`

## Architecture-Design Result Pattern

Typical result fields:

- `domainId`
- `metrics`
- `violations`
- optional topology/runtime findings

## Model Design Principles

1. IDs must be stable enough for comparison.
2. Evidence should remain traceable to source fragments or derived findings.
3. Unknowns belong at both metric level and response level.
4. Domain packs may extend result payloads, but the outer response stays the same.
