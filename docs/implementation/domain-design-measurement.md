# Domain Design Measurement

Use this page for the current `domain_design` implementation.

For conceptual formulas, read [../concepts/domain-design.md](../concepts/domain-design.md).
For human interpretation, read [../reference/domain-design-metrics.md](../reference/domain-design-metrics.md).

## Source of Truth

- command routing: `src/commands.ts`
- scoring orchestration: `src/core/scoring.ts`
- review conversion: `src/core/review.ts`
- reports and gates: `src/core/report.ts`

## Current Flow

`score.compute --domain domain_design` currently does this:

1. load policy and model
2. parse the repository
3. detect contract usage and boundary leaks
4. normalize Git history and compute `ELS`
5. optionally attach persistence shadow or pilot analysis
6. if `--docs-root` is present, extract glossary, rules, and invariants
7. compute `DRF`, `ULI`, `BFS`, and `AFS`
8. assemble the shared response

## Metric Input Map

| Metric | Main inputs | Current notes |
|---|---|---|
| `DRF` | docs, extracted rules, extracted invariants | skipped without `--docs-root` |
| `ULI` | glossary, trace links, code hits | skipped without `--docs-root` |
| `BFS` | model, docs, trace links, leaks, contract usage | skipped without `--docs-root` |
| `AFS` | invariants, terms, trace links | skipped without `--docs-root` |
| `MCCS` | repo, model, cross-context references, boundary leaks | runs without docs |
| `ELS` | repo, policy, Git history | runs without docs |

## Docs-Dependent Metrics

`DRF`, `ULI`, `BFS`, and `AFS` are not computed without `--docs-root`.

In that case:

- the run can still succeed
- response-level `unknowns` explain that those metrics were skipped
- `MCCS` and `ELS` remain available

## History and Locality

`ELS` depends on normalized Git history.

Large repositories are read through streamed `git log` parsing rather than fixed stdout buffers, so history analysis no longer depends on `execFile`-style maxBuffer limits.
When a domain model is available, the current implementation also scopes `git log` to the model's context globs so unrelated paths do not dominate large-repository history runs.

Typical low-confidence conditions:

- no relevant commits
- very thin history
- history analysis failure

When history is thin, read `confidence` and `unknowns` before trusting the numeric value.

## Persistence Shadow and Pilot Behavior

The current locality rollout surfaces are intentionally separate:

- `history.analyze_persistence`: score-neutral history topology inspection
- `history.compare_locality_models`: score-neutral side-by-side comparison
- `score.compute --shadow-persistence`: keeps `ELS` unchanged and adds `result.shadow.localityModels`
- `score.compute --pilot-persistence ...`: may replace effective `ELS` only when the selected rollout category is currently allowed to replace it

Pilot mode records:

- baseline `ELS`
- persistence candidate value
- effective locality source
- overall and category gate states

## Output Semantics

Important current behavior:

- response-level `unknowns` aggregate skipped inputs and approximation notes
- metric-level `unknowns` stay attached to each metric
- `status` is not driven by `unknowns` alone
- `review.list_unknowns` turns low confidence and unknowns into review items
- `report.generate` reuses the same measured result rather than recomputing meaning differently

## Related Documents

- Shared runtime contract: [runtime-and-commands.md](runtime-and-commands.md)
- Domain metric meaning: [../reference/domain-design-metrics.md](../reference/domain-design-metrics.md)
- Policy and thresholds: [../operations/policy-and-ci.md](../operations/policy-and-ci.md)
