# Self-Measurement Runbook

This runbook fixes the operational order for architecture self-measurement in this repository.

## When to run what

- Run `npm run self:architecture:refresh` when measured or derived inputs may be stale.
- Run `npm run self:architecture:complexity` after you intentionally changed the curated complexity snapshot.
- Run `npm run self:architecture:baseline` only when you want to establish a new `IPS` comparison point.
- Run `npm run self:architecture:check` before relying on self-measurement results locally or in CI.
- Run `npm run self:quality:summary` when you want an advisory readout of current unknown and proxy pressure in both self-measurement domains.

## Standard update sequence

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # optional and intentional
npm run self:architecture:check
```

## Quality gate

- `npm run check`
- `npm run test:coverage`
- `npm run self:architecture:check`
- `npm run self:quality:summary`

`test:coverage` is the local equivalent of the CI quality gate. `self:architecture:check` is the operational check for reviewed architecture snapshots. `self:quality:summary` is advisory and makes unknown-count and proxy-growth regressions visible without turning them into a separate hard gate.

## Long-Running Authoritative Runs

- Use the full `domain_design` or `architecture_design` input set when you need the final number. Do not switch to a reduced profile just to make the run appear faster.
- On large repos, `domain_design` can still take a while even after history ingestion was scoped to modeled paths. The remaining time is usually docs extraction and evidence assembly, not a stalled process.
- If you want live progress in a non-interactive shell or CI log, run with `CONTEXT_PROBE_PROGRESS=1`.
- Let the command finish and read the final `status`, `result`, `unknowns`, `diagnostics`, and `provenance`. Those are the authoritative outputs for a completed run.
- If a run looks quiet, check the shell or CI job duration and logs before changing inputs. Re-running with a smaller bundle changes the measurement, so treat that as a deliberate choice rather than a timeout workaround.

## Snapshot roles

- `scenario-observations`: measured from local benchmarks
- `boundary-map`: derived from constraints
- `self-measurement-domain-evidence.md`: maintained use cases, aggregate ownership, and strong invariants for repository self-measurement in `domain_design`
- `architecture-complexity-snapshot.yaml`: curated source of truth
- `architecture-complexity-export.yaml`: derived from the curated complexity snapshot
- `architecture-contract-baseline.yaml`: intentional comparison point for `IPS`
- telemetry / pattern runtime / delivery snapshots: curated observation inputs

## Monitoring signals

- `Measurement Quality` in score, gate, report, and review output is the canonical summary for `unknownsCount`, `proxyMetrics`, `proxyRate`, and `decisionRisk`.
- `Runtime` metadata is additive and stage-based. Use it to see whether time is going into input loading, extraction, history, analysis, or render work.
- `self:quality:summary` prints the current self-measurement unknown and proxy totals for both domains so CI logs show drift explicitly.

## Expected limitations

On this repository, some architecture unknowns remain expected limitations of a small CLI codebase.

- `ALR`
- `FCC`
- `SICR`
- `SLA`

`APSI` remains a summary-only metric, but that alone should not be treated as missing evidence when its supporting metrics are present.

Treat those as self-measurement caveats unless evidence says otherwise.
