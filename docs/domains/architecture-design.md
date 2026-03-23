# Architecture Design Evaluation Specification

- Version: v0.2
- Domain ID: `architecture_design`
- Purpose: compare concrete architecture candidates for one system under evidence-backed constraints

## Questions This Pack Answers

1. How well does a design fit the quality scenarios that matter for this system?
2. Does the implementation actually follow the chosen architecture pattern?
3. Does runtime behavior fulfill the promise of that pattern?
4. Are changes localized and evolution-friendly?
5. Is the added complexity tax justified by the gain?

## Unit of Evaluation

The target is not a pattern name in the abstract.

The real evaluation unit is a concrete design candidate under:

- business goals
- quality-attribute scenarios
- organizational constraints
- operational constraints
- data constraints
- security and audit constraints

## Principles

1. start with scenarios, not with pattern preference
2. AI helps extract and organize evidence, not free-score designs
3. every score must carry evidence, confidence, and unknowns
4. benefit and complexity tax must be separated
5. greenfield and brownfield can use the same formulas with different evidence sources

## Top-Level Model

### `APSI`: Architecture Pattern Suitability Index

```text
APSI = 0.30*QSF + 0.20*PCS + 0.20*OAS + 0.15*EES + 0.15*(1-CTI)
```

- `QSF`: quality scenario fit
- `PCS`: pattern conformance score
- `OAS`: operational adequacy score
- `EES`: evolution efficiency score
- `CTI`: complexity tax index

`APSI` is a summary-only index and must be read with its supporting metrics.

## Supporting Metrics

### `QSF`

Scenario-based fit score derived from QAW/ATAM thinking.

### `PCS`

Pattern-conformance score. In the current implementation it is approximated through:

- `DDS`
- `BPS`
- `IPS`

### `OAS`

Runtime adequacy composed from:

- `CommonOps`
- `PatternRuntime`

### `EES`

Evolution efficiency composed from:

- delivery performance
- locality

### `CTI`

Complexity tax covering deployables, pipelines, contracts, datastores, on-call surface, sync depth, and run cost.

## Pattern-Family Focus

### Layered / Clean / Hexagonal

- emphasize `QSF` and `PCS`
- focus on dependency discipline and domain isolation

### Modular Monolith / Microservices

- emphasize `EES` and `CTI`
- focus on deploy independence, change locality, and operational coordination cost

### CQRS

- emphasize `QSF`, `OAS`, and `CTI`
- focus on invariant closure, projection freshness, replay divergence, and stale-read acceptability

### Event-Driven

- emphasize `OAS` and `CTI`
- focus on schema compatibility, idempotency, replay recovery, DLQ behavior, and lag

## Current Metric Examples

### Layered / Clean / Hexagonal

- `DDVR`
- `LBR`
- `CPR`
- `DPR`
- `PMR`

### Service-Based / Microservices

- `IDR`
- `SDVR`
- `SCD95`
- `DTNR`
- `CSCR`

### CQRS

- `RWSC`
- `ICR`
- `PFL95`
- `RDR`
- `SCR`

### Event-Driven

- `ABR`
- `SCPR`
- `ICC`
- `DLR`
- `EL95`
- `RRSR`

## Greenfield vs Brownfield

### Greenfield

Lean more on:

- `QSF`
- static rules
- pre-production benchmarks
- chaos and contract tests
- estimated `CTI`

### Brownfield

Lean more on:

- observed `QSF`
- `OAS`
- `EES`
- measured `CTI`

## Initial Adoption Set

Start small:

- `QSF`
- `DDS`
- `BPS`
- `OAS`
- `EES`
- `AELS`
- `CTI`

## Current Implementation Relationship

Current implementation already computes:

- `DDS`
- `BPS`
- `IPS`
- `TIS`
- `QSF`
- `OAS`
- `CTI`
- `AELS`
- `EES`
- `APSI`

Some of these remain partial or proxy-based. See [architecture-metric-mapping.md](architecture-metric-mapping.md).

## Cautions

- do not score pattern names in isolation
- do not treat `APSI` as a standalone KPI
- do not mix estimated greenfield evidence with mature brownfield evidence carelessly
- do not ignore `CTI`, or complex options will appear falsely attractive
