# Metric Reference

- Version: v0.2
- Purpose: human-readable reference for the major metrics used by `context-probe`

This document explains:

- what each metric is trying to measure
- what a good state looks like
- what low scores usually suggest
- what to improve next
- where the current implementation still uses proxies or partial evidence

## Core Reading Rules

### Do not collapse design quality into one KPI

`context-probe` intentionally separates different dimensions of quality.

- Domain design is split into representation, language integrity, boundary fitness, aggregate fitness, code conformance, and evolution locality.
- Architecture design is split into scenario fit, pattern conformance, runtime adequacy, evolution efficiency, and complexity tax.

### Compare within the same product

Use summary indices for:

- candidate comparison inside one system
- before/after refactoring comparison
- time-series tracking inside one product

Do not use them as organization-wide rankings.

### Read `score`, `confidence`, and `unknowns` separately

- `score`: arithmetic result from observed evidence
- `confidence`: how trustworthy that score is
- `unknowns`: what remained unobserved, ambiguous, or approximated

## Domain Design Metrics

### `DRF`: Domain Representation Fitness

```text
DRF = 0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA
```

Measures whether the model reflects business knowledge without major omission or distortion.

Good state:

- major use cases can be traced to model elements
- business rules and invariants are explicit
- review interpretation does not split badly

Watch for:

- rules buried only in prose
- model diagrams that are not tied to actual behavior
- repeated review disagreement around core concepts

Next action:

- make use-case-to-model links explicit
- separate rule and invariant catalogs
- resolve ambiguous concepts in glossary and rules first

Implementation note:

- current `SC`, `IV`, and `RA` include heuristic proxies based on extracted fragments and review burden

### `ULI`: Ubiquitous Language Integrity

```text
ULI = 0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL
```

Measures whether language is stable inside each context and traceable across docs, models, and code.

Good state:

- canonical terms are stable inside each context
- aliases are intentional and documented
- terms can be traced into code and contracts

Watch for:

- alias sprawl
- term collisions across contexts without translation boundaries
- glossary terms that never appear in code

Next action:

- maintain glossary per context
- make Published Language, ACLs, DTOs, and event names explicit
- improve traceability from glossary to model and code

### `BFS`: Boundary Fitness Score

```text
A(P) = Σ a_ij [same_context(i,j)] / Σ a_ij
R(P) = Σ r_ij [different_context(i,j)] / Σ r_ij
BFS = 0.50*A + 0.50*R
```

Measures whether elements that belong together stay together, and elements that must be separated are actually separated.

Good state:

- invariants, lifecycle, and usage signals cluster inside the same context
- ownership, security, compliance, and cadence differences produce real separation
- the team can explain why the boundary exists

Watch for:

- one use case constantly traversing many contexts
- different ownership or security zones sharing internal types
- boundaries chosen mainly by UI or package layout convenience

Next action:

- review attraction and separation signals explicitly
- add ownership and security evidence to the model
- inspect high co-change boundaries first

### `AFS`: Aggregate Fitness Score

```text
AFS = 0.60*SIC + 0.40*(1-XTC)
```

Measures whether strong invariants are enclosed by the right consistency boundary.

Good state:

- strong invariants close inside one aggregate
- critical writes finish inside a single aggregate
- strong invariants and process invariants are clearly distinguished

Watch for:

- routine need for multi-aggregate atomic writes
- distributed transactions becoming normal
- oversized aggregates with heavy change contention

Next action:

- classify invariants into strong vs process
- identify which aggregate owns each synchronous consistency responsibility
- revisit boundaries where strong invariants frequently cross

Implementation note:

- current implementation falls back to `context as aggregate proxy` when explicit aggregate definitions are missing

### `MCCS`: Model-to-Code Conformance Score

```text
MCCS = 0.50*MRP + 0.25*(1-BLR) + 0.25*CLA
```

Measures whether code still respects the intended design boundaries.

Good state:

- cross-context communication uses public contracts
- internal types do not leak across contexts
- design rules are enforced in CI

Watch for:

- direct imports of another context's internal model or service
- returning internal models directly instead of contract DTOs
- design docs that no longer have any enforcement power

Next action:

- detect cross-context imports in CI
- move interactions behind DTOs, events, or ACLs
- fix the noisiest leak boundaries first

### `ELS`: Evolution Locality Score

```text
ELS = 0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)
```

Measures whether real changes stay localized over time.

Good state:

- most feature or issue work touches only a small number of contexts
- recurring co-change pairs are rare
- design boundaries and evolution units line up

Watch for:

- the same context pairs changing together in every PR
- hidden dependencies visible only in history
- high feature scatter and large review surfaces

Next action:

- inspect high co-change pairs
- track touched-context counts per issue or feature
- filter out bulk-format, rename, and dependency-noise commits

### Domain Summary Indices

```text
DDFI_pre = 0.35*DRF + 0.20*ULI + 0.30*BFS + 0.15*AFS
DDFI_post = 0.20*DRF + 0.15*ULI + 0.20*BFS + 0.15*AFS + 0.10*MCCS + 0.20*ELS
```

Use them as summary-only comparison aids. The current CLI does not emit them directly yet.

## Architecture Design Metrics

### `QSF`: Quality Scenario Fit

Measures how well a candidate design fits the quality scenarios that matter for this system.

Good state:

- top scenarios are prioritized
- targets and worst acceptable values are defined
- actual observations are tied back to scenarios

Watch for:

- discussions framed only as pattern preference
- missing targets and worst-case bounds
- lots of scenarios with no prioritization

Next action:

- define the top scenarios first
- normalize benchmark, SLO, and incident signals into scenario observations

### `PCS`: Pattern Conformance Score

Conceptually this is the score for whether the chosen pattern is actually enforced. In the current implementation it is represented through `DDS`, `BPS`, and `IPS`.

Good state:

- pattern-specific rules are explicit
- those rules are checked continuously
- violations are observable rather than assumed away

Watch for:

- a pattern name without enforceable rules
- package structure that looks disciplined while dependencies are not
- contract drift with no CI protection

Next action:

- define rule sets per pattern family
- evaluate dependency direction, purity, and contract stability separately

### `DDS`: Dependency Direction Score

Measures whether dependencies move in the intended direction.

Good state:

- forbidden dependency edges are rare
- layer bypassing is rare
- the codebase maps well to defined layers

Next action:

- fix direction violations in the noisiest layers first

### `BPS`: Boundary Purity Score

Measures whether internal boundaries are kept free from adapter leaks, framework contamination, and shared internal components.

Good state:

- framework concerns stay at the edges
- internal helpers are not silently shared across unrelated boundaries

Next action:

- isolate framework-heavy code and reduce shared internal assets

### `IPS`: Interface Protocol Stability

Measures the stability and cleanliness of public contracts.

Good state:

- contracts are explicit and stable
- risky exports and implementation coupling are rare

Next action:

- make contract files explicit and stabilize public DTO/type boundaries

### `TIS`: Topology Isolation Score

Bridge metric used to approximate runtime isolation when full operational evidence is not present.

Good state:

- shared dependencies are limited
- sync calls do not casually cross isolation boundaries
- runtime containment is meaningful

Next action:

- add explicit isolation boundaries to topology models
- reduce shared resources and cross-boundary sync chains

### `OAS`: Operational Adequacy Score

Measures whether the runtime behavior actually fulfills the promise of the architecture pattern.

Good state:

- latency, error, and saturation are visible by traffic band
- pattern-specific runtime signals are also available
- runtime behavior does not undermine the chosen design

Watch for:

- acceptable generic ops with weak pattern-runtime signals
- heavy dependence on bridge or neutral fallback values

Next action:

- normalize telemetry by traffic band
- add the minimum pattern-runtime observation set

### `AELS`: Architecture Evolution Locality Score

Measures how localized architecture-level changes remain across boundaries.

Good state:

- cross-boundary co-change is uncommon
- propagation and clustering cost stay low

Next action:

- define boundary maps explicitly
- review the most frequent cross-boundary change pairs

### `EES`: Evolution Efficiency Score

Measures delivery performance together with historical locality.

Good state:

- lead time, recovery, and change-fail performance are healthy
- locality is healthy as well

Watch for:

- fast delivery that still requires wide coordinated changes
- good DORA-like signals with poor locality

Next action:

- inspect delivery and locality separately before acting

### `CTI`: Complexity Tax Index

Measures the operational and cognitive tax introduced by the chosen design.

Good state:

- deployables, pipelines, schemas, datastores, on-call surface, sync depth, and run cost are proportionate to team capacity and business need

Watch for:

- higher operational coordination cost with little measurable gain
- rising on-call or schema burden hidden behind architectural enthusiasm

Next action:

- start with deployables per team and on-call surface
- add missing complexity metadata to evidence inputs

### `APSI`: Architecture Pattern Suitability Index

```text
APSI = 0.30*QSF + 0.20*PCS + 0.20*OAS + 0.15*EES + 0.15*(1-CTI)
```

Summary-only score for architecture comparison.

Use it only after reading:

- `QSF`
- `PCS` or its current proxies
- `OAS`
- `EES`
- `CTI`

## Minimum Starting Set

For domain design:

- `DRF`: `SC`, `RA`
- `ULI`: `AE`, `TC`
- `BFS`: `A`, `R`
- `AFS`: `SIC`
- `MCCS`: `BLR`
- `ELS`: `CCL`

For architecture design:

- `QSF`
- `DDS`
- `BPS`
- `OAS`
- `EES`
- `AELS`
- `CTI`
