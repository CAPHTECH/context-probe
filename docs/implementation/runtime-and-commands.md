# Runtime and Commands

## Purpose

This document describes the runtime pipeline and command model used by the CLI.

Use this page for command behavior and the shared runtime contract.

- For metric meaning, read `reference/`.
- For per-domain current implementation details, read [domain-design-measurement.md](domain-design-measurement.md) and [architecture-design-measurement.md](architecture-design-measurement.md).

The design principle is simple:

- AI handles extraction, candidate generation, and ambiguity surfacing
- deterministic analyzers handle repeatable validation and score computation

## Runtime Pipeline

```text
CLI command
  -> input loading
  -> artifact normalization
  -> optional AI extraction
  -> deterministic analysis
  -> formula evaluation
  -> response assembly
```

## Main Commands

### `score.compute`

Primary entry point for measurement.

Typical responsibilities:

- load policy
- choose domain pack
- load model or constraints
- run analyzers
- compute metrics
- return evidence, confidence, unknowns, diagnostics, and provenance

### `report.generate`

Wraps `score.compute` and renders a Markdown report.

### `gate.evaluate`

Wraps `score.compute` and applies policy thresholds.

### `review.list_unknowns`

Turns unknowns, low-confidence signals, and collisions into review items.

### `score.compute --domain ai_change_review`

Advisory branch-diff review flow for AI-authored changes.

Required inputs:

- `--repo`
- `--base-branch`
- `--head-branch`

Current implementation:

- diffs `git merge-base(base, head)..head`
- parses the current working tree to count reverse dependencies
- inspects repository history to flag changed files that overlap with hotspots
- checks nearby tests and diff size
- returns `result.diffSummary` and `result.reviewTargets`

`review.list_unknowns` converts `result.reviewTargets` into review items with `path` and representative `line` in item provenance.

This domain is advisory-only in v1. `report.generate` and `gate.evaluate` do not support it.

### `history.analyze_persistence`

Experimental history-topology inspection for co-change structure.

This command is score-neutral. It surfaces stable clusters, natural split levels, and noise characteristics, but it does not replace `ELS` or change existing scoring formulas.

### `history.compare_locality_models`

Experimental side-by-side comparison between the current `ELS` locality surface and the beta0 persistence candidate.

This command is also score-neutral. It is meant for calibration and adoption decisions, not for replacing `ELS` inside `score.compute`.

### `score.observe_shadow_rollout`

Single-repository observation wrapper around `score.compute --shadow-persistence`.

It keeps `ELS` as the source of truth and exposes the candidate delta, drift category, and shadow payload for one repository.

### `score.observe_shadow_rollout_batch`

Batch observation wrapper for multiple repositories.

This command reads a YAML or JSON `--batch-spec`, runs `score.observe_shadow_rollout` per entry, and returns both per-repository observations and category or overall aggregates such as weighted delta and delta range.

### `gate.evaluate_shadow_rollout`

Adoption-gate evaluation for the beta0 persistence shadow rollout.

This command either reads a versioned `--registry` of curated real-repo observations or reuses a live `--batch-spec` observation run, then returns the current replacement verdict, rollout disposition, reasons, and category summaries.
Category summaries also carry their own `replace` or `shadow_only` decision so rollout can diverge by repo typology even when the overall gate stays closed.

### Document/Trace Commands

- `doc.extract_glossary`
- `doc.extract_rules`
- `doc.extract_invariants`
- `history.analyze_persistence`
- `history.compare_locality_models`
- `trace.link_terms`
- `trace.link_model_to_code`

These are useful when you need to inspect extracted evidence directly.

## Authoring Utilities

- `model.scaffold`: infers context and aggregate candidates from the repo, optionally strengthens them with `--docs-root`, and returns both `result.model` and a loadable YAML string in `result.yaml`
- `constraints.scaffold`: infers layer candidates from the repo and returns both `result.constraints` and a loadable YAML string in `result.yaml`

`constraints.scaffold` also returns reviewable starter drafts in `result.drafts` for `scenarioObservationsTemplate`, `scenarioCatalog`, `topologyModel`, and `boundaryMap`. The `scenarioObservationsTemplate` is deliberately not a measured observation set. It is a review-only template that names the scenarios and marks them as `needs_measurement`, so you can fill them from benchmark or incident data without inventing observed values. The other drafts are starter inputs for docs-first repos that need architecture files before the first score run; they do not replace curated observations or a reviewed constraints file.

Scaffold commands keep the shared JSON response contract. They do not write files directly.

## Domain Inputs

### Domain Design

Required:

- `--repo`
- `--model` for scoring

Optional:

- `--docs-root`
- `--shadow-persistence`
- `--pilot-persistence`
- `--rollout-category <category>`
- `--shadow-rollout-registry <path>`
- `--batch-spec`
- `--registry`
- extraction backend settings
- policy/profile overrides

If you do not have a model yet, start with `model.scaffold --repo <path> [--docs-root <path>]` and review the returned YAML before scoring.

`--shadow-persistence` computes the beta0 persistence comparison in parallel with normal domain scoring and returns it under `result.shadow.localityModels`. It does not change `ELS`, thresholds, or aggregate scores.

`--pilot-persistence` is a category-gated rollout mode. It forces the same shadow comparison, loads a curated shadow-rollout registry, and only replaces `ELS` when the selected `--rollout-category` currently has a category verdict of `replace`. The pilot result is returned under `result.pilot`, including the baseline `ELS`, persistence candidate value, effective `ELS`, and both overall and category gate states.

For rollout calibration across multiple repositories, use `score.observe_shadow_rollout_batch --batch-spec <path>`. The batch spec is YAML or JSON and lists repo/model pairs plus optional category and policy overrides. The command returns per-repo observations together with category and overall aggregates.

Use `gate.evaluate_shadow_rollout --registry <path>` to evaluate the current curated adoption gate without rerunning measurements, or `gate.evaluate_shadow_rollout --batch-spec <path>` to evaluate a live batch observation run.

`--batch-spec` is used by `score.observe_shadow_rollout_batch` and `gate.evaluate_shadow_rollout`. The spec is YAML or JSON and contains a version plus an `entries` array. Each entry provides `repo`, `model`, `repoId`, and optional `label`, `category`, `modelSource`, `policy`, and `tieTolerance`. Relative paths are resolved from the batch-spec file location.

`--registry` is used by `gate.evaluate_shadow_rollout`. It points at a versioned YAML or JSON registry of curated real-repo observations, such as `fixtures/validation/shadow-rollout/registry.yaml`.

### Architecture Design

Required:

- `--repo`
- `--constraints` for scoring

Optional:

- scenario catalog and observations
- telemetry inputs
- delivery inputs
- topology model
- boundary map
- complexity sources

If you do not have constraints yet, start with `constraints.scaffold --repo <path>` and review the returned YAML before scoring.

## Output Shape

Every command is expected to align to the shared response contract:

- `status`
- `result`
- `evidence`
- `confidence`
- `unknowns`
- `diagnostics`
- `provenance`
- `version`

## Design Rules

1. deterministic analyzers never rely on hidden AI state
2. formulas come from policy, not runtime invention
3. skipped or approximated inputs must surface through `unknowns`
4. source origins must remain visible in `provenance`
5. reporting and gate evaluation are downstream views of the same measured result
