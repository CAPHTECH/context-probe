# Persistent Homology Adoption Tasks

## Purpose

Introduce TDA into `context-probe` in stages, starting from the highest-value and most reproducible scope.

This note turns the design-review conclusion into an implementation order.

## Summary

Adopt:

- pilot `0D persistence` as a support diagnostic for co-change analysis
- treat `TSI`, if added, as a separate metric or bridge metric
- keep BFS candidate comparison as a separate command

Do not adopt now:

- replacing the meaning of `ELS` immediately
- flowing `TSI` directly into `APSI`
- mixing `TSI` into `confidence`
- starting with `MCCS + beta1`

## Execution Order

### Task 0: Improve history hygiene first

- tighten `normalizeHistory`
- document merge, rename, bulk-change, and windowing policy
- make `scoreEvolutionLocality` confidence reflect input quality more clearly

### Task 1: Add a shared co-change persistence kernel

- start with `beta0` only
- fix edge-weight policy before exposing user-facing outputs
- cover empty history, single-context, and degenerate-weight cases

### Task 2: Add a score-neutral experimental history command

- keep `ELS` unchanged
- expose stable change clusters, natural split levels, and noise ratio
- treat diagrams and barcodes as debug-only outputs

### Task 3: Evaluate a `TSI` closer to `AELS`

- evaluate it in the architecture-locality context
- keep it separate from `confidence`
- validate it before considering any `APSI` integration

### Task 4: Prototype BFS candidate comparison as a separate command

- keep `computeBoundaryFitness` as a scorer
- keep candidate generation outside `score.compute`

### Task 5: Defer `MCCS + beta1`

- current leak semantics do not align cleanly enough yet
- verify whether SCC or cycle-basis analysis is sufficient first

## No-Go Conditions

Defer the adoption if any of these become true:

- existing `ELS` trend comparison breaks
- hidden logic grows beyond declarative policy formulas
- `score` and `confidence` meanings become mixed
- locality is counted twice inside `APSI`
- the mathematical meaning of `beta1` cannot be explained

## Recommended Immediate Sequence

1. finish Task 0
2. implement Task 1 with `beta0` only
3. expose Task 2 as an experimental command
4. evaluate Task 3 only if the pilot proves useful
5. keep Task 4 on a separate prototype track
6. leave Task 5 deferred
