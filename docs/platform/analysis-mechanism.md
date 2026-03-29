# Analysis Mechanism

- Version: v0.1
- Audience: CLI users who want to understand the current implementation without reading all source files

This document explains how current inputs flow into `metrics`, `unknowns`, `confidence`, and `evidence`.

## Source of Truth

- command routing: `src/commands.ts`
- scoring orchestration: `src/core/scoring.ts`
- review conversion: `src/core/review.ts`
- reporting and gates: `src/core/report.ts`

## High-Level Flow

```text
score.compute
  -> load policy
  -> choose domain
  -> load inputs
  -> run analyzers
  -> evaluate formulas
  -> create response

review.list_unknowns
  -> transform score response into review items

report.generate
  -> reuse score response and render Markdown

gate.evaluate
  -> reuse score response and evaluate thresholds
```

## Shared Components

| Component | Role |
|---|---|
| `parseCodebase` | build source/dependency view |
| `normalizeHistory` | normalize Git history |
| `extractGlossary` | extract term candidates from docs |
| `extractRules` | extract rule candidates from docs |
| `extractInvariants` | extract invariant candidates from docs |
| `buildTermTraceLinks` | trace terms into docs and code |
| `createResponse` | build the shared response envelope |
| `confidenceFromSignals` | combine confidence signals |
| `listReviewItems` | turn unknowns and low confidence into review items |

## Domain-Design Path

Current execution order is roughly:

1. load model and policy
2. parse the repository
3. detect contract usage and boundary leaks
4. normalize Git history and compute evolution locality
5. optionally inspect co-change topology through the experimental `history.analyze_persistence` surface
6. optionally compare `ELS` with the beta0 persistence candidate through `history.compare_locality_models`, or attach the same comparison as a shadow payload when `score.compute --shadow-persistence` is enabled
7. if `--docs-root` is present, lazily extract glossary, rules, and invariants
8. compute boundary fitness, aggregate fitness, and trace links
9. evaluate formulas
10. assemble the final response

Important behavior:

- `DRF`, `ULI`, `BFS`, and `AFS` require `--docs-root`
- `MCCS` and `ELS` can run without docs
- `history.analyze_persistence` is score-neutral and does not replace `ELS`
- `history.compare_locality_models` is score-neutral and exists only to calibrate the persistence candidate against `ELS`
- `score.compute --shadow-persistence` keeps `ELS` as the source-of-truth metric and only adds `result.shadow.localityModels` for observation
- `score.compute --pilot-persistence --rollout-category <category> --shadow-rollout-registry <path>` still computes the same shadow payload, but it may replace the effective `ELS` value when the selected category gate is currently `replace`
- pilot mode records the baseline `ELS`, persistence candidate value, effective locality source, and overall or category gate state under `result.pilot`
- `score.observe_shadow_rollout_batch` exists to compare shadow deltas across a curated repo set without changing production scoring
- `gate.evaluate_shadow_rollout` evaluates the curated adoption gate from either a versioned registry or a live batch observation without changing production scoring
- response-level unknowns aggregate skipped inputs and approximation notes

## Architecture-Design Path

Current execution order is roughly:

1. load constraints and policy
2. parse the repository
3. compute `DDS`, `BPS`, and `IPS`
4. compute scenario and topology-based scores (`QSF`, `TIS`)
5. ingest/normalize telemetry into `OAS`
6. ingest/normalize delivery into `EES`
7. ingest complexity metadata into `CTI`
8. compute history locality into `AELS`
9. summarize into `APSI`

Important behavior:

- several architecture metrics are still partial or proxy-based
- `APSI` is explicitly summary-only
- `PCS` is currently approximated through `DDS`, `BPS`, and `IPS`
- `OAS` may fall back to `TIS`

## Reading Unknowns

Typical reasons for unknowns:

- missing required optional evidence, such as docs or telemetry
- low volume history
- proxy fallback used instead of direct observation
- source precedence caused one input path to be ignored

Use `unknowns` before trusting a strong-looking score.
