---
name: context-probe-analysis-workflow
description: Run `context-probe` measurements and analyze the results after repo inputs exist. Executes `score.compute`, `report.generate`, `gate.evaluate`, `review.list_unknowns`, and deeper `doc.extract_*` `trace.*` `history.*` or `review.resolve` only when needed. Use when asked to measure a repo, analyze a result, inspect unknowns, or continue after YAML inputs are ready.
---

# Context Probe Analysis Workflow

Run `context-probe` after curated inputs already exist.

Respond in English while this skill is active unless the user explicitly asks for another language.

If the repo does not have maintained YAML inputs yet, switch to `context-probe-inputs-workflow` first.

Read [references/command-recipes.md](references/command-recipes.md) when you need exact command shapes.
Read [references/interpret-results.md](references/interpret-results.md) immediately after any run.
Read [references/investigate-correctness.md](references/investigate-correctness.md) only when the result looks suspicious or too weak to trust.
Read [references/final-summary.md](references/final-summary.md) before closing.

## Workflow

### 1. Classify the request

Place the user in one of these paths before running anything:

- fresh `domain_design` measurement
- fresh `architecture_design` measurement
- readable report or gate decision from existing inputs
- unknown or low-confidence review
- suspicious result investigation
- explicit review resolution replay

### 2. Start with the smallest useful path

Run the narrowest command that answers the request:

- first-time or broad measurement: start with `score.compute`
- human-readable output: add `report.generate`
- threshold decision only: use `gate.evaluate`
- human review targets: use `review.list_unknowns`
- extraction, trace, and history commands: use only to inspect why a result looks weak or wrong
- `review.resolve`: use only when review items and explicit human resolutions already exist

### 3. Interpret before escalating

Read outputs in this order:

1. `status`
2. summary of `result`
3. `confidence`
4. `unknowns`
5. `diagnostics`
6. `provenance`

Separate the result into:

- metrics already directional enough to discuss
- metrics still proxy-heavy because inputs or observations are missing
- mismatches that suggest wrong inputs or wrong expectations

### 4. Investigate trust and correctness

If results look suspicious, incomplete, or lower-confidence than expected, inspect likely causes before changing curated YAML:

- use `review.list_unknowns` to see unresolved gaps
- use `doc.extract_*` to inspect extracted terms, rules, or invariants
- use `trace.link_terms` or `trace.link_model_to_code` to inspect linking evidence
- use `history.*` to inspect locality and co-change signals
- use `review.resolve` only to apply explicit human review decisions, then rerun the affected extraction or score path

### 5. Close with a disposition

End with a concise summary that states:

- what was measured
- what looks high confidence
- what remains unknown
- recommended next actions
- the next command only if it materially advances the analysis

Do not turn every run into an issue proposal. Finish with the measured state first.

## Guardrails

- Do not use this skill to invent or curate YAML inputs from scratch.
- Do not start with `doc.extract_*` for a first measurement unless direct evidence inspection is the task.
- Do not confuse `--model` and `--constraints`.
- Do not treat `status: ok` as proof that the result is complete or high confidence.
- Do not ignore `unknowns`, `diagnostics`, or `provenance`.
- Do not edit curated YAML only to suppress unknowns. Inspect the evidence path first.
