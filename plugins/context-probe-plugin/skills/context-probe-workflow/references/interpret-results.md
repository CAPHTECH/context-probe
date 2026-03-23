# Interpret Results

Use this reference whenever a `context-probe` command returns a result.

## Read Fields in Order

1. `status`
2. `result`
3. `confidence`
4. `unknowns`
5. `diagnostics`
6. `provenance`

## Meaning of Key Fields

### `status`

- `ok`: the command completed successfully
- `warning`: the command completed but important caveats exist
- `error`: required inputs were missing, an exception occurred, or the command could not be treated as successful

`status: ok` does not mean the result is complete or high-confidence.

### `confidence`

This is the trust signal for the output. Lower confidence means the user should inspect inputs, evidence quality, or review items more carefully.

### `unknowns`

These are unresolved gaps. They can come from skipped inputs, missing docs, thin history, proxy behavior, or incomplete observations. Treat them as work still to do.

### `diagnostics`

These explain what happened during execution, such as skipped analysis paths or fallback behavior.

### `provenance`

This records where the result came from, such as:

- repo path
- `docs-root`
- active profile
- source config paths

Use it to verify that the command measured the intended inputs.

## Review Items vs Findings vs Evidence

- `evidence`: the supporting source material or trace
- `finding`: a detected problem or judgment built from evidence
- `review item`: something that still needs human confirmation
- `unknown`: a gap or unresolved question carried by the response

## Escalation Rules

- If the user wants a readable narrative, use `report.generate`.
- If the user wants only threshold pass/fail behavior, use `gate.evaluate`.
- If the user wants to know what still needs human review, use `review.list_unknowns`.
