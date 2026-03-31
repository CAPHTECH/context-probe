# Architecture Design Measurement

Use this page for the current `architecture_design` implementation.

For conceptual formulas, read [../concepts/architecture-design.md](../concepts/architecture-design.md).
For human interpretation, read [../reference/architecture-design-metrics.md](../reference/architecture-design-metrics.md).

## Source of Truth

- command routing: `src/commands.ts`
- scoring orchestration: `src/core/scoring.ts`
- reports and gates: `src/core/report.ts`
- policy defaults: `src/core/policy.ts`

## Current Flow

`score.compute --domain architecture_design` currently does this:

1. load policy and constraints
2. parse the repository
3. compute static scores: `DDS`, `BPS`, `IPS`
4. compute scenario and topology scores: `QSF`, `TIS`
5. ingest or normalize telemetry and pattern-runtime inputs into `OAS`
6. ingest or normalize delivery inputs into `EES`
7. ingest complexity inputs into `CTI`
8. compute architecture locality into `AELS`
9. summarize into `APSI`

## Concept vs Current Implementation

| Conceptual metric | Current implementation | Status |
|---|---|---|
| `QSF` | `QSF` | partial when scenario observations are thin |
| `PCS` | `DDS`, `BPS`, `IPS` | implemented through supporting metrics |
| `OAS` | `OAS`, `TIS` bridge | partial when runtime signals are thin |
| `EES` | `EES`, `AELS` | partial when delivery or history is thin |
| `CTI` | `CTI` | partial when metadata is missing |
| `APSI` | `APSI` | summary-only |

## Source Precedence

### Scenario inputs

1. `scenario-observations`
2. `scenario-observation-source`
3. otherwise `QSF` stays unobserved

`constraints.scaffold` does not fabricate `scenario-observations`. It emits a review-only `scenarioObservationsTemplate` so you can capture the right scenarios before collecting benchmark or incident data.

### Telemetry and pattern-runtime inputs

For `CommonOps`:

1. `telemetry-observations`
2. `telemetry-raw-observations + telemetry-normalization-profile`
3. `telemetry-export`
4. `telemetry-source`

For `PatternRuntime`:

1. `pattern-runtime-observations`
2. `pattern-runtime-raw-observations + pattern-runtime-normalization-profile`
3. pattern runtime embedded in telemetry export
4. `TIS` bridge

### Delivery and complexity inputs

For `Delivery`:

1. `delivery-observations`
2. `delivery-raw-observations + delivery-normalization-profile`
3. `delivery-export`
4. `delivery-source`

For `CTI`:

1. `complexity-export`
2. `complexity-source`
3. constraints metadata and codebase-derived proxies

The repository self-measurement bundle keeps curated operational metadata in `architecture-complexity-snapshot.yaml` and regenerates the canonical `complexity-export` file from that snapshot instead of keeping operational metadata inside `architecture-constraints.yaml`.

Direct file inputs accept the canonical shapes above, and some collector-native summaries are normalized on load:

- `scenario-observations` can read canonical observation sets or benchmark / incident-review summaries
- `constraints.scaffold` emits a review-only `scenarioObservationsTemplate`; it does not invent observed values
- `delivery-export` can read canonical export bundles, DORA summaries, or rich documents that embed `contextProbe.exportBundle`
- when `delivery-export` is used without `delivery-normalization-profile`, the canonical export ingestion path applies the built-in DORA normalization defaults; explicit raw delivery input still requires an explicit normalization profile
- `complexity-export` can read canonical export bundles, raw complexity snapshots, or rich documents that embed `contextProbe.exportBundle`

### Contract baseline inputs

1. `contract-baseline`
2. `contract-baseline-source`
3. otherwise `CBC` / `BCR` remain current-state proxies

## Metric Input Map

| Metric | Main inputs | Current notes |
|---|---|---|
| `QSF` | scenario catalog, observations | depends on normalized scenario observations |
| `DDS` | repo, constraints | static and direct |
| `BPS` | repo, constraints | static and direct |
| `IPS` | repo, constraints, optional contract baseline | static; `CBC` / `BCR` become baseline-backed when a contract baseline is provided |
| `TIS` | topology model, runtime observations | used as an explicit bridge signal |
| `OAS` | telemetry, pattern runtime, `TIS` bridge | can include normalization and fallback paths |
| `AELS` | Git history, boundary map or constraint layers | uses boundary proxy when explicit map is missing |
| `EES` | delivery inputs, `AELS` | combines delivery and locality |
| `CTI` | complexity metadata, exports, codebase counts | often partial when metadata is thin |
| `APSI` | supporting metrics above | summary-only and profile-weighted |

For locality scoring, `git log` is scoped to boundary-map globs when an explicit boundary map is present, otherwise to the constraint-layer globs.

## Report and Gate Behavior

Current report behavior:

- `APSI` is shown separately as a summary section
- supporting metrics are shown before bridge metrics are trusted
- proxy or partial signals remain visible through unknowns

Current gate behavior:

- policy thresholds are read from the active profile
- `APSI` is treated as summary-only and does not dominate architecture failures by itself
- supporting metrics are the main gate inputs

## Related Documents

- Shared runtime contract: [runtime-and-commands.md](runtime-and-commands.md)
- Architecture metric meaning: [../reference/architecture-design-metrics.md](../reference/architecture-design-metrics.md)
- Policy and CI: [../operations/policy-and-ci.md](../operations/policy-and-ci.md)
- Source collectors: [../operations/architecture-source-collectors.md](../operations/architecture-source-collectors.md)
