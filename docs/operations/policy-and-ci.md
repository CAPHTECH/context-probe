# Policy and CI

## Purpose

This document explains how metric formulas, thresholds, reviews, and CI gating are expected to work.

## Policy Responsibilities

Policy controls:

- metric formulas
- warn/fail thresholds
- profile-specific weighting
- review escalation rules
- history filters

## CI Guidance

Recommended usage:

1. run `score.compute`
2. run `gate.evaluate`
3. run `npm audit --audit-level=moderate`
4. run `npm run self:architecture:check`
5. run `npm run self:quality:summary`
6. publish `report.generate` output when helpful
7. route `review.list_unknowns` output to human review

`ai_change_review` is advisory-only in v1. For pre-merge branch review, use this shorter flow instead:

1. run `score.compute --domain ai_change_review --base-branch <base> --head-branch <head>`
2. run `review.list_unknowns --domain ai_change_review --base-branch <base> --head-branch <head>`
3. route that queue to human review

Do not use `gate.evaluate` or `report.generate` for this domain yet.

For the operational order around self-measurement snapshots, coverage, and release-preflight checks, see [self-measurement-runbook.md](self-measurement-runbook.md).
For the release-time checklist that covers validation and packaging, see [release-preflight.md](release-preflight.md).

When `--pilot-persistence --rollout-category <category> --shadow-rollout-registry <path>` is enabled for `domain_design`, the returned `ELS` metric may be replaced by the persistence candidate for categories whose curated gate currently says `replace`. CI gate semantics do not change: `gate.evaluate` still judges only the returned metric values against policy thresholds.

## Suggested Rules

### Domain Design

- fail on meaningful `MCCS` degradation
- warn or fail on `BLR` growth
- monitor `ELS` trends rather than single runs

### Architecture Design

- treat `APSI` as summary-only
- gate primarily on supporting metrics
- keep proxy/partial unknowns visible in reports

## Review Escalation

Escalate when:

- confidence is below threshold
- unknowns are present
- collisions or ambiguity are detected
- proxy evidence dominates a decision
- history hotspots or scenario-input gaps appear in review output

## History Filters

Keep explicit filters for:

- formatting-only commits
- dependency bump churn
- lockfiles or generated files that would distort locality

## See Also

- [self-measurement-runbook.md](self-measurement-runbook.md)
