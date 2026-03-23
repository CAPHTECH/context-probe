# Investigate Correctness

Use this reference when results look wrong, incomplete, or unexpectedly weak.

## Check Input Shape First

Verify that the command used the right required inputs:

- `domain_design` needs `--model`
- `architecture_design` needs `--constraints`
- extraction commands need `--docs-root`

If the wrong input type was used, fix that before deeper investigation.

## Check for Skipped Evidence

Look for missing or reduced inputs:

- no `--docs-root`
- insufficient Git history
- missing scenario, telemetry, delivery, or complexity source config for architecture flows
- provider CLI unavailable for extraction flows

These often show up in `unknowns` or `diagnostics`.

## Check Provenance

Confirm the response actually used the intended:

- repository path
- docs root
- profile
- source config paths

If provenance is wrong, rerun before interpreting the metrics.

## Check Confidence and Review Queue

If confidence is low:

- inspect `review.list_unknowns`
- examine collisions or low-confidence extraction items
- use `review.resolve` for explicit human overrides
- rerun extraction with `--review-log` and `--apply-review-log` when appropriate

## Common Root Causes

- first-time users started with extraction instead of scoring
- the wrong domain was selected
- the repository lacks enough history for history-based signals
- docs and code do not line up, producing real ambiguity rather than tool failure
- architecture source configs were missing or partial

## Investigation Order

Use this order to avoid overclaiming:

1. validate command arguments
2. inspect `unknowns`
3. inspect `diagnostics`
4. inspect `provenance`
5. inspect confidence and review items
6. rerun with corrected inputs

Only after that should you suggest that the result may reflect a real design problem or a tool limitation.
