---
name: context-probe-workflow
description: Guide users through context-probe setup, scoring, extraction, review, result interpretation, correctness investigation, and final issue-ready disposition when they ask to use or analyze context-probe.
---

# Context Probe Workflow

Guide users through `context-probe` in English.

Respond in English while this skill is active unless the user explicitly asks for another language.

## What This Skill Covers

- preparation and prerequisite checks
- core measurement commands
- extraction and review loops
- result interpretation
- correctness investigation
- final summary and issue confirmation

## Workflow

### 1. Classify the request

Place the user in one of these paths before suggesting commands:

- `domain_design` scoring
- `architecture_design` scoring
- extraction and review (`doc.extract_*`, `review.list_unknowns`, `review.resolve`)
- result interpretation or trust investigation

Read [references/preparation.md](references/preparation.md) first.

### 2. Start with the smallest useful path

Prefer the shortest path that answers the user’s need:

- first-time or broad measurement: start with `score.compute`
- human-readable output: add `report.generate`
- threshold decision only: use `gate.evaluate`
- human review targets: use `review.list_unknowns`
- extraction and override loop: use `doc.extract_*` and `review.resolve` only when the user needs document extraction or ambiguity cleanup

Use [references/command-recipes.md](references/command-recipes.md) for concrete command shapes.

### 3. Interpret before escalating

Read outputs in this order:

1. `status`
2. summary of `result`
3. `confidence`
4. `unknowns`
5. `diagnostics`
6. `provenance`

Use [references/interpret-results.md](references/interpret-results.md) before drawing conclusions.

### 4. Investigate trust and correctness

If results look suspicious, incomplete, or lower-confidence than expected, inspect likely causes before claiming the tool is wrong.

Use [references/investigate-correctness.md](references/investigate-correctness.md).

### 5. Close with a disposition

End with a concise summary that states:

- what was measured
- what looks high confidence
- what remains unknown
- recommended next actions
- whether the user wants to turn findings into issues

Do not create issues automatically in this workflow. Stop at confirmation.

Use [references/final-summary.md](references/final-summary.md).

## Guardrails

- Do not start with `doc.extract_*` for a first-time scoring request unless the user explicitly needs extraction.
- Do not confuse `--model` and `--constraints`.
- Do not treat `status: ok` as proof that the result is complete or high confidence.
- Do not ignore `unknowns`, `diagnostics`, or `provenance`.
- Do not recommend issue creation before summarizing evidence and open questions.
