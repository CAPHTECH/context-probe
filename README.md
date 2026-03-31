# AI-Assisted Design Measurement Platform

Japanese version: [README.ja.md](README.ja.md)

This is a docs-first repository for measuring design quality with evidence, using AI-assisted extraction together with deterministic analyzers. The current implementation covers domain-design and architecture-design evaluation, and the documentation is split so future packs can extend the same measurement model without changing the reading model.

Japanese documents are the primary source of truth. English documents mirror the same structure and document roles.

## Start Reading

1. [docs/README.md](docs/README.md)
2. [docs/guides/user-guide.md](docs/guides/user-guide.md)
3. [docs/concepts/measurement-model.md](docs/concepts/measurement-model.md)
4. [docs/reference/domain-design-metrics.md](docs/reference/domain-design-metrics.md)
5. [docs/reference/architecture-design-metrics.md](docs/reference/architecture-design-metrics.md)
6. [docs/implementation/runtime-and-commands.md](docs/implementation/runtime-and-commands.md)
7. [docs/roadmap/phased-delivery.md](docs/roadmap/phased-delivery.md)

## Documentation Map

- [docs/README.md](docs/README.md): documentation index
- [docs/guides/user-guide.md](docs/guides/user-guide.md): quickest path for first-time CLI use
- [docs/concepts/](docs/concepts): conceptual specifications and measurement model
- [docs/reference/](docs/reference): how to interpret metrics and summary scores
- [docs/implementation/](docs/implementation): how the current CLI computes and reports the metrics
- [docs/operations/](docs/operations): policy, CI, and collector operation guidance
- [docs/roadmap/](docs/roadmap): phased rollout and experimental notes

## First Commands To Learn

- `score.compute`
- `report.generate`
- `gate.evaluate`
- `review.list_unknowns`

## Core Principles

- Use AI as an evidence extractor and ambiguity reducer, not as the scorer.
- Compute scores through fixed formulas and deterministic analysis.
- Attach `evidence`, `confidence`, `unknowns`, and `provenance` to every metric.
- Prefer candidate comparison and time-series comparison over cross-organization ranking.
- Add new evaluation domains as packs on top of a shared measurement foundation.

## Current Implementation

- TypeScript / Node CLI implementation is available.
- Phase 1 capabilities include dependency analysis, boundary-leak detection, evolutionary locality, score computation, reporting, and gate evaluation.
- Phase 2 entry points include external CLI extractors for `doc.extract_*`, evidence-backed term links via `trace.*`, and review log support via `review.resolve`.
- Pack boundaries for `domain_design` and `architecture_design` are already present for future expansion.

## Quick Start

If you want the shortest setup-to-command path, start with [docs/guides/user-guide.md](docs/guides/user-guide.md).

```bash
npm install
npm run dev -- --help
```

If you want to try the published package entry point:

```bash
npx context-probe --help
```

If you want the compiled CLI as well:

```bash
npm run build
node dist/src/cli.js --help
```

### Scaffold Inputs First

If you do not have a reviewed `--model` or `--constraints` file yet, scaffold one first and inspect `result.yaml`.

```bash
npm run dev -- model.scaffold \
  --repo . \
  --docs-root docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo .
```

`constraints.scaffold` also returns reviewable starter drafts for architecture inputs in `result.drafts`: `scenarioCatalog`, `topologyModel`, and `boundaryMap`. Use those drafts as the starting point for docs-first repos when you need architecture input files before the first scoring run.

### Measure Domain Design

```bash
npm run dev -- score.compute \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

Add `--docs-root docs` when you want document-derived metrics included in the run.

For large repos, `domain_design` is an authoritative run: keep the full model and docs inputs, let it finish, and read the final `status`, `result`, `unknowns`, `diagnostics`, and `provenance` instead of switching to a reduced profile just to shorten the wall time.

When you run the CLI in a TTY, or set `CONTEXT_PROBE_PROGRESS=1`, the scorer emits stage progress lines to stderr while it works. That output is advisory; the final JSON response remains the source of truth.

### Generate a Markdown Report

```bash
npm run dev -- report.generate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --format md
```

### Measure Architecture Design

```bash
npm run dev -- score.compute \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --domain architecture_design
```

For architecture runs, `--constraints` is required instead of `--model`.

If you want self-measurement with fewer proxy fallbacks in `QSF`, `TIS`, `OAS`, and `EES`, pass the reviewed supporting inputs from `config/self-measurement/` as well.

Refresh the measured and derived architecture snapshots before a self-measurement run:

```bash
npm run self:architecture:refresh
```

Capture the intentional `IPS` contract baseline separately:

```bash
npm run self:architecture:baseline
```

Audit freshness drift without rewriting snapshots:

```bash
npm run self:architecture:audit
```

Run the CI-shaped local check that combines the advisory freshness audit with a score smoke:

```bash
npm run self:architecture:check
```

For release-time validation and packaging, use [docs/operations/release-preflight.md](docs/operations/release-preflight.md).

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

These are reviewable snapshots, not live collectors. `scenario-observations` comes from local benchmarks. `telemetry`, `pattern runtime`, `delivery`, and the raw `architecture-complexity-snapshot.yaml` remain curated observation inputs. `complexity-export` is a derived artifact built from that raw complexity snapshot. `npm run self:architecture:refresh` refreshes the measured `scenario-observations` and the derived `boundary-map`. `npm run self:architecture:complexity` regenerates `architecture-complexity-export.yaml` from the curated complexity snapshot. `npm run self:architecture:baseline` captures the current contract surface into a reviewable `IPS` baseline and intentionally stays outside `refresh` so baseline deltas remain meaningful. `npm run self:architecture:audit` is the CI-friendly advisory check for freshness drift, and `npm run self:architecture:check` is the local/CI operational check that runs that audit plus a score smoke.

The expected maintenance loop is:

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # only when you intentionally want a new IPS comparison point
npm run self:architecture:check
```

Coverage is also part of the quality gate now:

```bash
npm run test:coverage
```

The operational sequence is summarized in [docs/operations/self-measurement-runbook.md](docs/operations/self-measurement-runbook.md).

For this repository specifically, some architecture unknowns are still expected limitations of a small CLI codebase: `ALR`, `FCC`, `SICR`, and `SLA` remain evidence-limited, and `PCS` remains a proxy composite. Treat those as self-measurement caveats, not immediate defects.

### Ingest Brownfield Evidence Through Source Config

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/qsf/repo \
  --constraints fixtures/validation/scoring/qsf/constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --contract-baseline-source fixtures/examples/architecture-sources/contract-baseline-source.file.yaml \
  --scenario-catalog fixtures/validation/scoring/qsf/scenarios.yaml \
  --scenario-observation-source fixtures/examples/architecture-sources/scenario-observation-source.command.yaml \
  --telemetry-source fixtures/examples/architecture-sources/telemetry-source.command.yaml \
  --telemetry-normalization-profile fixtures/validation/scoring/oas/raw-normalization-profile.yaml \
  --complexity-source fixtures/examples/architecture-sources/complexity-source.command.yaml \
  --profile layered
```

Collector and source-config details are documented in [docs/operations/architecture-source-collectors.md](docs/operations/architecture-source-collectors.md).

### List Unknowns That Need Human Review

```bash
npm run dev -- review.list_unknowns \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

### Advanced: Extract Glossary Terms With Codex CLI

```bash
npm run dev -- doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider codex
```

### Advanced: Re-run Extraction With a Review Log

```bash
npm run dev -- doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider claude \
  --review-log path/to/review-log.json \
  --apply-review-log
```

## Measure This Repository

Minimal self-measurement definitions are stored in [config/self-measurement/domain-model.yaml](config/self-measurement/domain-model.yaml), [config/self-measurement/architecture-constraints.yaml](config/self-measurement/architecture-constraints.yaml), [config/self-measurement/architecture-complexity-snapshot.yaml](config/self-measurement/architecture-complexity-snapshot.yaml), and [config/self-measurement/architecture-complexity-export.yaml](config/self-measurement/architecture-complexity-export.yaml).

### 1. Enable Git History

`ELS` reads Git history. In an uninitialized environment it will fall back to warnings and low confidence. If you have not initialized Git locally yet, run:

```bash
git init
git add .
git -c user.name="Context Probe" -c user.email="context-probe@example.com" commit -m "chore: initialize context-probe"
```

### 2. Compute Domain-Design Score

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

### 3. Compute Architecture-Design Score

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --complexity-export config/self-measurement/architecture-complexity-export.yaml \
  --boundary-map config/self-measurement/architecture-boundary-map.yaml \
  --scenario-catalog config/self-measurement/architecture-scenarios.yaml \
  --scenario-observations config/self-measurement/architecture-scenario-observations.yaml \
  --topology-model config/self-measurement/architecture-topology.yaml \
  --runtime-observations config/self-measurement/architecture-runtime-observations.yaml \
  --telemetry-observations config/self-measurement/architecture-telemetry-observations.yaml \
  --pattern-runtime-observations config/self-measurement/architecture-pattern-runtime-observations.yaml \
  --delivery-observations config/self-measurement/architecture-delivery-observations.yaml \
  --policy fixtures/policies/default.yaml
```

Without those supporting files, architecture self-measurement will still run, but many metrics fall back to neutral or proxy behavior.

### 4. Generate a Markdown Report

```bash
npm run dev -- report.generate \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --format md
```

## Verification

```bash
npm run check
npm test
```

`npm test` includes extraction-quality regression checks backed by the curated golden corpus under `fixtures/validation/extraction/`. Those checks exercise the existing CLI commands such as `doc.extract_*`, `trace.link_terms`, and `review.list_unknowns` with `must_include`, `must_exclude`, `must_link_to_code`, and `max_review_items`.
