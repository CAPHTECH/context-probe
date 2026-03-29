# Domain Design Metrics

Use this page for human interpretation of `domain_design` metrics.

For conceptual formulas, read [../concepts/domain-design.md](../concepts/domain-design.md).
For the current CLI behavior, read [../implementation/domain-design-measurement.md](../implementation/domain-design-measurement.md).

## Overview

| Metric | Main question |
|---|---|
| `DRF` | Does the model reflect business knowledge without major omission or distortion? |
| `ULI` | Is language stable inside each context and traceable across docs and code? |
| `BFS` | Are things that belong together together, and are separations meaningful? |
| `AFS` | Do strong invariants close within the right consistency boundary? |
| `MCCS` | Does the implementation still respect the intended boundaries? |
| `ELS` | Do real changes stay localized over time? |

## `DRF`

Measures whether the domain model reflects important use cases, rules, and invariants.

Good state:

- major use cases can be traced to model elements
- important rules and invariants are explicit
- reviewers do not split badly on core concepts

Watch for:

- rules buried only in prose
- diagrams that are detached from actual behavior
- repeated disagreement around central terms

Next action:

- map use cases to model elements explicitly
- separate rule and invariant catalogs
- fix ambiguous concepts in glossary and rules first

## `ULI`

Measures whether language stays stable inside each context and traceable across docs and code.

Good state:

- canonical terms are stable inside each context
- aliases are intentional and documented
- terms can be traced into contracts and code

Watch for:

- alias sprawl
- term collisions without explicit translation boundaries
- glossary terms that never appear in code

Next action:

- maintain glossary per context
- make Published Language, ACLs, DTOs, and event names explicit
- improve glossary-to-code traceability

## `BFS`

Measures whether bounded contexts are split for the right reasons.

Good state:

- invariant and lifecycle signals cluster inside the same context
- ownership, security, and cadence differences produce real separation
- the team can explain why the boundary exists

Watch for:

- one use case repeatedly traversing many contexts
- different ownership or security zones sharing internal types
- boundaries chosen only for UI or package convenience

Next action:

- review attraction and separation signals explicitly
- add ownership and security evidence to the model
- inspect high co-change boundaries first

## `AFS`

Measures whether strong invariants are enclosed by the right consistency boundary.

Good state:

- strong invariants close inside one aggregate
- critical writes finish inside a single aggregate
- strong invariants and process invariants are clearly separated

Watch for:

- routine multi-aggregate atomic writes
- distributed transactions becoming normal
- oversized aggregates with heavy write contention

Next action:

- classify invariants into strong vs process
- identify which aggregate owns each synchronous responsibility
- revisit boundaries where strong invariants frequently cross

## `MCCS`

Measures whether code still respects the intended design boundaries.

Good state:

- cross-context communication goes through public contracts
- internal types do not leak across contexts
- design rules are enforced in CI

Watch for:

- direct imports of another context's internal model or service
- returning internal models directly instead of contract DTOs
- design docs that no longer have enforcement power

Next action:

- detect cross-context imports in CI
- move interactions behind DTOs, events, or ACLs
- fix the noisiest leak boundaries first

## `ELS`

Measures whether real changes stay localized over time.

Good state:

- most feature work touches only a small number of contexts
- recurring co-change pairs are rare
- design boundaries and evolution units line up

Watch for:

- the same context pairs changing together in every PR
- hidden dependencies visible only in history
- wide review surfaces caused by feature scatter

Next action:

- inspect high co-change pairs
- track touched-context counts per issue or feature
- filter bulk-format, rename, and dependency-noise commits

## Summary Indices

`DDFI_pre` and `DDFI_post` are summary-only comparison aids.

Use them for:

- candidate comparison inside one system
- before/after comparison
- time-series tracking

Do not use them as universal rankings.
