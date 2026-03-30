# Self-Measurement Runbook

This runbook fixes the operational order for architecture self-measurement in this repository.

## When to run what

- Run `npm run self:architecture:refresh` when measured or derived inputs may be stale.
- Run `npm run self:architecture:complexity` after you intentionally changed the curated complexity snapshot.
- Run `npm run self:architecture:baseline` only when you want to establish a new `IPS` comparison point.
- Run `npm run self:architecture:check` before relying on self-measurement results locally or in CI.

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

`test:coverage` is the local equivalent of the CI quality gate. `self:architecture:check` is the operational check for reviewed architecture snapshots.

## Snapshot roles

- `scenario-observations`: measured from local benchmarks
- `boundary-map`: derived from constraints
- `architecture-complexity-snapshot.yaml`: curated source of truth
- `architecture-complexity-export.yaml`: derived from the curated complexity snapshot
- `architecture-contract-baseline.yaml`: intentional comparison point for `IPS`
- telemetry / pattern runtime / delivery snapshots: curated observation inputs

## Expected limitations

On this repository, some architecture unknowns remain expected limitations of a small CLI codebase.

- `ALR`
- `FCC`
- `SICR`
- `SLA`
- `PCS` proxy composite

Treat those as self-measurement caveats unless evidence says otherwise.
