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

### Measure Domain Design

```bash
npm run dev -- score.compute \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

Add `--docs-root docs` when you want document-derived metrics included in the run.

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

### Ingest Brownfield Evidence Through Source Config

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/qsf/repo \
  --constraints fixtures/validation/scoring/qsf/constraints.yaml \
  --policy fixtures/policies/default.yaml \
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

Minimal self-measurement definitions are stored in [config/self-measurement/domain-model.yaml](config/self-measurement/domain-model.yaml) and [config/self-measurement/architecture-constraints.yaml](config/self-measurement/architecture-constraints.yaml).

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
  --policy fixtures/policies/default.yaml
```

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
