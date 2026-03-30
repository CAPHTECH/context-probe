# User Guide

This guide is the shortest path for a first-time user to run `context-probe`, execute one representative measurement, and understand how to read the output.

Use this before diving into the deeper specifications.

## What It Is

`context-probe` is a CLI for evidence-based design measurement.

- AI extracts candidate evidence from documents, such as terms, rules, and invariants.
- Deterministic analyzers process dependencies, boundary leaks, history, and score formulas.
- Outputs always include `evidence`, `confidence`, `unknowns`, and `provenance`.

The first commands to learn are:

- `score.compute`
- `report.generate`
- `gate.evaluate`
- `review.list_unknowns`

## Before You Start

Prerequisites:

- Node.js 24+
- A local clone of this repository

Setup:

```bash
npm install
npm run build
```

To inspect the command catalog:

```bash
npm run dev -- --help
```

All examples below assume you run commands from the repository root through `npm run dev -- ...`.

If you do not have a model or constraints file yet, scaffold one first:

```bash
npm run dev -- model.scaffold \
  --repo . \
  --docs-root docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo .
```

Both commands return review-first YAML in `result.yaml`. The CLI does not write files automatically.

## First 10 Minutes

Start with a single domain-design run:

```bash
npm run dev -- score.compute \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

What this gives you:

- The main `domain_design` metrics
- A standard response with `status`, `result`, `evidence`, `confidence`, `unknowns`, `diagnostics`, and `provenance`
- A traceable view of what the run actually observed

If you want document-driven metrics as well, add `--docs-root docs`.

## Representative Workflows

### 1. Measure architecture design

```bash
npm run dev -- score.compute \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --domain architecture_design
```

For architecture runs, `--constraints` is required instead of `--model`.

This bare command is enough to run, but `QSF`, `TIS`, `OAS`, and `EES` stay neutral or proxy-heavy unless you also provide scenario, topology, runtime, telemetry, and delivery inputs.

This repository keeps a reviewed self-measurement bundle under `config/self-measurement/`.

Before running the full architecture self-measurement bundle, refresh the measured and derived snapshots:

```bash
npm run self:architecture:refresh
```

Capture the intentional `IPS` contract baseline separately:

```bash
npm run self:architecture:baseline
```

To audit freshness drift without rewriting any snapshots:

```bash
npm run self:architecture:audit
```

To run the CI-shaped local operational check, which combines the freshness audit with a score smoke:

```bash
npm run self:architecture:check
```

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --complexity-export config/self-measurement/architecture-complexity-export.yaml \
  --boundary-map config/self-measurement/architecture-boundary-map.yaml \
  --contract-baseline config/self-measurement/architecture-contract-baseline.yaml \
  --scenario-catalog config/self-measurement/architecture-scenarios.yaml \
  --scenario-observations config/self-measurement/architecture-scenario-observations.yaml \
  --topology-model config/self-measurement/architecture-topology.yaml \
  --runtime-observations config/self-measurement/architecture-runtime-observations.yaml \
  --telemetry-observations config/self-measurement/architecture-telemetry-observations.yaml \
  --pattern-runtime-observations config/self-measurement/architecture-pattern-runtime-observations.yaml \
  --delivery-observations config/self-measurement/architecture-delivery-observations.yaml \
  --policy fixtures/policies/default.yaml
```

Those architecture inputs are reviewable snapshots rather than live collectors. `scenario-observations` comes from local benchmarks. `telemetry`, `pattern runtime`, `delivery`, and the raw `architecture-complexity-snapshot.yaml` are maintained as curated observation snapshots. `complexity-export` is derived from that raw complexity snapshot. `npm run self:architecture:refresh` refreshes the measured `scenario-observations` and the derived `boundary-map`. `npm run self:architecture:complexity` regenerates `architecture-complexity-export.yaml` from the curated complexity snapshot. `npm run self:architecture:baseline` captures a reviewable `IPS` baseline from the current contract surface and intentionally stays outside `refresh` so baseline deltas remain stable. `npm run self:architecture:audit` is the CI-friendly advisory version of that freshness check. `npm run self:architecture:check` is the operational check that runs the advisory audit plus an architecture score smoke.

Recommended upkeep order:

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # only when you intentionally want a new IPS comparison point
npm run self:architecture:check
```

When you want the same quality gate locally that CI uses, run:

```bash
npm run test:coverage
```

On this repository, some unknowns are still expected limitations of a small CLI codebase: `ALR`, `FCC`, `SICR`, and `SLA` are evidence-limited, and `PCS` remains a proxy composite. That is a self-measurement caveat, not an automatic bug report.

### 2. Generate a Markdown report

```bash
npm run dev -- report.generate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --format md
```

`result.report` contains a human-readable Markdown summary of the measurement.

### 3. Evaluate policy gates

```bash
npm run dev -- gate.evaluate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

Key outputs:

- `status`
- `result.gate.failures`
- `result.gate.warnings`

### 4. List items that need human review

```bash
npm run dev -- review.list_unknowns \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

Use this when you want a review queue derived from low confidence, collisions, or unresolved unknowns.

### 5. Advanced: run the application persistence pilot

When the curated shadow-rollout gate says the `application` category is ready for replacement, you can run the category-gated pilot directly from the main report and gate surfaces.

Pilot report example:

```bash
npm run dev -- report.generate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --format md \
  --pilot-persistence \
  --rollout-category application \
  --shadow-rollout-registry fixtures/validation/shadow-rollout/registry.yaml
```

Pilot gate example:

```bash
npm run dev -- gate.evaluate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --pilot-persistence \
  --rollout-category application \
  --shadow-rollout-registry fixtures/validation/shadow-rollout/registry.yaml
```

What changes in pilot mode:

- `score.compute` still calculates the shadow payload
- `result.pilot` records the baseline `ELS`, persistence candidate, effective locality source, and gate state
- the effective `ELS` may change only when the selected category gate currently says `replace`
- `tooling` remains `shadow_only` under the current curated gate

## How To Read Results

Recommended reading order:

### `status`

- `ok`: the run completed and no major warning dominated the result
- `warning`: the run completed, but there are caveats or unobserved areas
- `error`: required input is missing, an exception occurred, or a gate failed

### `confidence`

How trustworthy the result is. Lower values mean more human review is likely needed.

### `unknowns`

What the tool could not confirm. Even an `ok` run can contain unknowns.

### `diagnostics`

Execution-time notes such as fallback behavior or partial ingestion.

### `provenance`

The origin of the inputs used for the result.

## Common Pitfalls

### Mixing up `--model` and `--constraints`

- `domain_design` requires `--model`
- `architecture_design` requires `--constraints`

### Forgetting `--docs-root`

Domain-design scoring still runs without it, but document-derived metrics are skipped.

### Too little Git history

History-based metrics such as `ELS` or `AELS` depend on Git metadata. Thin history lowers confidence and increases unknowns.

### Running architecture self-measurement without supporting inputs

`architecture_design` still runs with only `--constraints`, but `QSF`, `TIS`, `OAS`, and `EES` are then much more likely to fall back to unobserved or bridge-based values. For self-measurement, pass the `config/self-measurement/architecture-*.yaml` files together.

### Starting with `doc.extract_*`

Those commands are useful, but they have more setup requirements. Start with `score.compute` and `report.generate` first.

## Where To Read Next

- Runtime pipeline and commands: [../implementation/runtime-and-commands.md](../implementation/runtime-and-commands.md)
- Shared metric reading rules: [../reference/metric-reading-guide.md](../reference/metric-reading-guide.md)
- Domain metric meaning: [../reference/domain-design-metrics.md](../reference/domain-design-metrics.md)
- Architecture metric meaning: [../reference/architecture-design-metrics.md](../reference/architecture-design-metrics.md)
- Current domain-design measurement path: [../implementation/domain-design-measurement.md](../implementation/domain-design-measurement.md)
- Current architecture-design measurement path: [../implementation/architecture-design-measurement.md](../implementation/architecture-design-measurement.md)
- Standard data model: [../concepts/data-model.md](../concepts/data-model.md)
- Policy and CI operation: [../operations/policy-and-ci.md](../operations/policy-and-ci.md)
- Source config and collectors: [../operations/architecture-source-collectors.md](../operations/architecture-source-collectors.md)
- Full document index: [../README.md](../README.md)
