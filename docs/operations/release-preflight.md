# Release Preflight

This runbook fixes the release-time order for this repository.

The same sequence is also available as `npm run release:preflight` so the documented release gate and the executable release gate stay aligned.

## When to run what

- Run `npm run check` before release to catch static analysis regressions.
- Run `npm run test:coverage` before release to confirm the test and branch-coverage floor.
- Run `npm run self:architecture:check` before release to verify the reviewed architecture snapshots.
- Run `npm run build` before release to make sure the package still compiles cleanly.
- Run `npm pack --dry-run` before release to inspect the published payload.

## Standard release sequence

```bash
npm run release:preflight
```

Equivalent expanded sequence:

```bash
npm run check
npm run test:coverage
npm run self:architecture:check
npm run build
npm pack --dry-run
```

## What this covers

- `check` covers type-checking, Biome, dependency-cruiser, and Knip.
- `test:coverage` confirms the test suite and coverage gate.
- `self:architecture:check` checks freshness drift and the architecture score smoke.
- `build` verifies the release artifact can still be produced.
- `npm pack --dry-run` verifies the package contents that would be published.

## Related guidance

- Policy and CI guidance: [policy-and-ci.md](policy-and-ci.md)
- Self-measurement runbook: [self-measurement-runbook.md](self-measurement-runbook.md)
