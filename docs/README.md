# Documentation Index

The documentation is organized around three responsibilities:

- `concepts/`: what the system is trying to measure
- `reference/`: how humans should read the metrics
- `implementation/`: how the current CLI actually computes and reports them

Japanese documents are the primary source of truth. English documents mirror the same structure so readers can move between languages without changing paths or document roles.

## Start Here

Choose the shortest path for your task:

1. First-time CLI usage: [guides/user-guide.md](guides/user-guide.md)
2. How to read `score`, `confidence`, and `unknowns`: [reference/metric-reading-guide.md](reference/metric-reading-guide.md)
3. Domain metric meaning: [reference/domain-design-metrics.md](reference/domain-design-metrics.md)
4. Architecture metric meaning: [reference/architecture-design-metrics.md](reference/architecture-design-metrics.md)
5. Current runtime and command model: [implementation/runtime-and-commands.md](implementation/runtime-and-commands.md)
6. Current domain-design measurement path: [implementation/domain-design-measurement.md](implementation/domain-design-measurement.md)
7. Current architecture-design measurement path: [implementation/architecture-design-measurement.md](implementation/architecture-design-measurement.md)

## Directory Guide

### `guides/`

- [user-guide.md](guides/user-guide.md)
  - Quick-start guidance for first-time CLI users.

### `reference/`

- [metric-reading-guide.md](reference/metric-reading-guide.md)
  - Shared rules for interpreting scores, confidence, unknowns, and summary metrics.
- [domain-design-metrics.md](reference/domain-design-metrics.md)
  - Human-readable meaning, warning signs, and next actions for domain-design metrics.
- [architecture-design-metrics.md](reference/architecture-design-metrics.md)
  - Human-readable meaning, warning signs, and next actions for architecture-design metrics.

### `implementation/`

- [runtime-and-commands.md](implementation/runtime-and-commands.md)
  - Runtime pipeline, command surface, and output contract.
- [domain-design-measurement.md](implementation/domain-design-measurement.md)
  - Current domain-design analyzers, input dependencies, unknowns, and rollout behavior.
- [architecture-design-measurement.md](implementation/architecture-design-measurement.md)
  - Current architecture-design analyzers, source precedence, proxy behavior, and report/gate semantics.

### `concepts/`

- [platform-vision.md](concepts/platform-vision.md)
  - Product vision, principles, and scope.
- [measurement-model.md](concepts/measurement-model.md)
  - Shared measurement model used across evaluation packs.
- [data-model.md](concepts/data-model.md)
  - Standard data structures such as Artifact, Evidence, and MetricScore.
- [domain-design.md](concepts/domain-design.md)
  - Conceptual specification for domain-design evaluation.
- [architecture-design.md](concepts/architecture-design.md)
  - Conceptual specification for architecture-design evaluation centered on APSI.
- [architecture-scenario-model.md](concepts/architecture-scenario-model.md)
  - Input model for quality scenarios used by architecture scoring.
- [architecture-pattern-profiles.md](concepts/architecture-pattern-profiles.md)
  - Pattern-family emphasis, gains, and complexity-tax guidance.
- [architecture-evidence-lifecycle.md](concepts/architecture-evidence-lifecycle.md)
  - How evidence sources shift across greenfield and brownfield phases.

### `operations/`

- [policy-and-ci.md](operations/policy-and-ci.md)
  - Thresholds, review conditions, and CI operation guidance.
- [architecture-source-collectors.md](operations/architecture-source-collectors.md)
  - Reference collectors and canonical source-config patterns for architecture evidence.

### `roadmap/`

- [phased-delivery.md](roadmap/phased-delivery.md)
  - Delivery phases from MVP through future expansion.
- [tda-persistent-homology-task.md](roadmap/tda-persistent-homology-task.md)
  - Experimental rollout notes for the persistence-topology locality work.
