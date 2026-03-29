# Domain Design Evaluation Specification

- Version: v0.2
- Domain ID: `domain_design`
- Purpose: quantify domain-design quality through evidence-backed metrics

## Questions This Pack Answers

1. Is the language stable inside each bounded context?
2. Are business rules and invariants reflected in the model?
3. Are bounded-context boundaries semantically and evolutionarily appropriate?
4. Do aggregates enclose strong invariants correctly?
5. Does the implementation respect the intended contracts and boundaries?
6. Are real-world changes localized?

## Inputs

### Design Artifacts

- vision / PRD
- use cases and stories
- glossary
- business-rule catalog
- invariant catalog
- context map
- aggregate diagram
- event storming outputs
- ADRs
- API specs, event specs, contract DTOs
- ownership, team-boundary, and security-zone information

### Implementation Artifacts

- application code
- test code
- module/build definitions
- configuration files
- schemas

### History

- Git history
- PR information
- issue / ticket history
- release information

## Main Capabilities

| ID | Capability | Output |
|---|---|---|
| D1 | term extraction and normalization | glossary graph |
| D2 | rule and invariant extraction | rule/invariant catalog |
| D3 | model loading or candidate inference | domain model graph |
| D4 | trace-link generation | traceability graph |
| D5 | structural analysis | dependency graph |
| D6 | boundary-leak detection | leak findings |
| D7 | bounded-context fitness scoring | boundary score |
| D8 | aggregate fitness scoring | aggregate fitness |
| D9 | evolution-locality analysis | evolution score |
| D10 | score calculation | metric scores |
| D11 | human-review support | review queue |

## Metrics

### `DRF`: Domain Representation Fitness

```text
DRF = 0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA
```

- `SC`: use-case coverage
- `RC`: rule coverage
- `IV`: invalid or irrelevant model-description ratio
- `RA`: review agreement

### `ULI`: Ubiquitous Language Integrity

```text
ULI = 0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL
```

- `GC`: glossary coverage
- `AE`: alias entropy
- `TC`: term collision rate
- `TL`: traceability-link coverage

### `BFS`: Boundary Fitness Score

```text
A(P) = Σ a_ij [same_context(i,j)] / Σ a_ij
R(P) = Σ r_ij [different_context(i,j)] / Σ r_ij
BFS = 0.50*A(P) + 0.50*R(P)
```

### `AFS`: Aggregate Fitness Score

```text
AFS = 0.60*SIC + 0.40*(1-XTC)
```

- `SIC`: strong invariant closure
- `XTC`: cross-aggregate transaction need

### `MCCS`: Model-to-Code Conformance Score

```text
MCCS = 0.50*MRP + 0.25*(1-BLR) + 0.25*CLA
```

- `MRP`: model-rule pass rate
- `BLR`: boundary leak ratio
- `CLA`: contract language adherence

### `ELS`: Evolution Locality Score

```text
ELS = 0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)
```

- `CCL`: cross-context change locality
- `FS`: feature scatter
- `SCR`: surprise coupling ratio

## Summary Indices

### Pre-Implementation

```text
DDFI_pre = 0.35*DRF + 0.20*ULI + 0.30*BFS + 0.15*AFS
```

### Post-Implementation

```text
DDFI_post = 0.20*DRF + 0.15*ULI + 0.20*BFS + 0.15*AFS + 0.10*MCCS + 0.20*ELS
```

Use summary indices for candidate comparison and time-series comparison, not as universal rankings.

## Typical Usage

### Greenfield

- compare multiple context-map candidates
- prioritize `DRF`, `ULI`, `BFS`, and `AFS`

### Brownfield

- inspect `BLR` and `ELS` first
- use co-change and leak findings to surface redesign candidates

### CI

- fail on newly introduced boundary leaks
- route collisions and ambiguities into review
- warn on `MCCS` or `MRP` degradation

## Acceptance Criteria

Functional:

1. common IDs connect document fragments, code locations, and commits
2. `ULI`, `MCCS`, and `ELS` return evidence-backed scores
3. boundary-leak results show concrete symbols and locations
4. all commands return `confidence` and `unknowns`
5. baseline comparison is supported
6. formula and threshold changes are policy-driven

Quality:

1. the same input yields stable results
2. review outcomes can influence re-measurement
3. false positives can be traced to evidence
4. reports link numbers back to evidence rather than stopping at scores

## Risks

| Risk | Meaning | Mitigation |
|---|---|---|
| over-automation | AI states too much with weak evidence | require confidence, unknowns, and review |
| weak inputs | glossary/rules are not maintained | expose observability gaps directly |
| metric misuse | summary index is treated as a verdict | document intended comparison-only use |
| noisy history | bulk changes pollute co-change | keep explicit history filters |
