# Repo Apply Playbook

This guide is the shortest stable path for applying `context-probe` to an existing repository.

Use it when you want to move from "this repo has no measurement inputs yet" to
"this repo has a reviewable assessment with maintained YAML inputs and observed
evidence files."

## What This Playbook Covers

The target flow is:

1. scaffold review-first drafts
2. curate the inputs you want to keep
3. run a starter assessment
4. add observation snapshots where proxy-heavy metrics matter
5. record an assessment note

This guide is intentionally repo-generic. It does not assume self-measurement
paths from this repository.

## Starter vs Authoritative

Use the same terms throughout your repo work:

- `scaffold`: a draft returned by the CLI. It is meant to be reviewed and edited,
  not trusted as-is.
- `curated input`: a YAML file that you intentionally keep in the target repo as
  part of the maintained measurement setup.
- `starter run`: a first scoring run with enough input to reveal direction,
  obvious misclassification, and missing evidence.
- `authoritative run`: a fuller scoring run with maintained inputs and observed
  evidence, suitable for actual design review discussions.
- `scenarioObservationsTemplate`: a template for recording measured or reviewed
  scenario outcomes. It is a blank checklist, not an observed dataset.

For most repos, `domain_design` becomes useful after curating
`domain-model.yaml`. `architecture_design` becomes much more useful after
curated constraints plus scenario, runtime, telemetry, delivery, and contract
evidence.

## Step 1. Scaffold Review-First Drafts

Create the first drafts before writing any permanent YAML:

```bash
npm run dev -- model.scaffold \
  --repo /path/to/target-repo \
  --docs-root /path/to/target-repo/docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo /path/to/target-repo
```

Save the returned YAML into reviewable files only after inspection.

Recommended starter file set:

- `domain-model.scaffold.yaml`
- `architecture-constraints.scaffold.yaml`
- `architecture-scenario-catalog.scaffold.yaml`
- `architecture-topology-model.scaffold.yaml`
- `architecture-boundary-map.scaffold.yaml`
- `architecture-scenario-observations.template.yaml`

## Step 2. Curate the Inputs You Will Keep

Do not treat scaffold output as final.

At this stage, the goal is not to perfect the measurement model. The goal is to
replace obviously wrong or noisy drafts with files that a human is willing to
keep in the repo.

Curate these files first:

- `domain-model.yaml`
  - keep the contexts you want
  - add explicit aggregates when they matter
  - remove technical or noisy candidates
- `architecture-constraints.yaml`
  - keep the layers and allowed edges you actually want
  - remove generic starter layers that are not meaningful in your repo
  - add repo-specific metadata such as complexity cost if you have it

Keep the scaffold files as disposable drafts for reference. Keep the curated files as the maintained inputs.

As a rule:

- keep scaffold files when they help future comparison
- point scoring commands at curated files once they exist
- change curated files only when you are intentionally improving the review baseline

## Step 3. Run the Starter Assessment

Start with one domain run and one architecture run.

Domain starter run:

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo /path/to/target-repo \
  --model /path/to/target-repo/docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root /path/to/target-repo/docs
```

Architecture starter run:

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo /path/to/target-repo \
  --constraints /path/to/target-repo/docs/architecture/context-probe/architecture-constraints.yaml \
  --scenario-catalog /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-catalog.scaffold.yaml \
  --topology-model /path/to/target-repo/docs/architecture/context-probe/architecture-topology-model.scaffold.yaml \
  --boundary-map /path/to/target-repo/docs/architecture/context-probe/architecture-boundary-map.scaffold.yaml \
  --policy fixtures/policies/default.yaml
```

Use the starter run to answer:

- Which metrics are already directional enough to discuss
- Which unknowns are caused by missing inputs
- Whether the curated `domain-model` and `constraints` need another pass

Do not over-interpret the starter run. Its purpose is to show:

- whether the structure is roughly right
- which metrics are already useful
- which metrics are still proxy-heavy because evidence is missing

If you need a review queue, use:

```bash
npm run dev -- review.list_unknowns ...
```

## Step 4. Add Observations Where They Matter

For `architecture_design`, these inputs most often move the result from starter
quality to review quality:

- `scenario-observations`: improves `QSF`
- `contract-baseline`: improves `IPS`
- `runtime-observations`: improves `TIS`
- `pattern-runtime-observations`: improves `OAS`
- `telemetry-observations`: improves `OAS`
- `delivery-observations` or delivery export: improves `EES`

Use `architecture-scenario-observations.template.yaml` as a checklist. Fill it
from benchmark runs or incident review. Do not invent observed values just to
remove unknowns.

For `domain_design`, the highest-leverage improvements are usually:

- explicit aggregates in `domain-model.yaml`
- better docs coverage through `--docs-root`
- sufficient git history for locality metrics

When starter results are unclear, the deeper commands are:

- `doc.extract_*`: inspect extracted terms, rules, and invariants
- `trace.*`: inspect model-to-code and term-to-code linking
- `history.*`: inspect locality and co-change evidence

Use the runtime contract reference only when you need implementation details:
[../implementation/runtime-and-commands.md](../implementation/runtime-and-commands.md)

A practical rule is:

- if the starter result already supports a design discussion, stop there
- if a metric is important and still proxy-heavy, add the missing observation
- if a result looks wrong, inspect extraction, trace, or history before editing more YAML

## Step 5. Run the Authoritative Assessment

Once curated inputs and observation snapshots exist, run the fuller bundle.

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo /path/to/target-repo \
  --constraints /path/to/target-repo/docs/architecture/context-probe/architecture-constraints.yaml \
  --scenario-catalog /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-catalog.scaffold.yaml \
  --scenario-observations /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-observations.yaml \
  --topology-model /path/to/target-repo/docs/architecture/context-probe/architecture-topology-model.scaffold.yaml \
  --boundary-map /path/to/target-repo/docs/architecture/context-probe/architecture-boundary-map.scaffold.yaml \
  --runtime-observations /path/to/target-repo/docs/architecture/context-probe/architecture-runtime-observations.yaml \
  --pattern-runtime-observations /path/to/target-repo/docs/architecture/context-probe/architecture-pattern-runtime-observations.yaml \
  --telemetry-observations /path/to/target-repo/docs/architecture/context-probe/architecture-telemetry-observations.yaml \
  --delivery-observations /path/to/target-repo/docs/architecture/context-probe/architecture-delivery-observations.yaml \
  --contract-baseline /path/to/target-repo/docs/architecture/context-probe/architecture-contract-baseline.yaml \
  --policy fixtures/policies/default.yaml
```

For `domain_design`, keep the full `domain-model.yaml` and `--docs-root` and
let the run finish. For large repos, treat it as an authoritative run rather
than switching to a reduced profile just to shorten wall time.

## Step 6. Record an Assessment

Keep a short assessment note next to the curated inputs.

Record at least:

- date
- repo path or revision
- which inputs were used
- final key metrics
- main remaining unknown classes
- next follow-up items

This lets future runs compare against a stable review baseline.

The assessment note is not a report for outsiders. It is a working record for
future maintainers that answers:

- what was measured
- how trustworthy the result was
- what still needs follow-up

## Command Map by Goal

| Goal | Commands |
| --- | --- |
| Scaffold first inputs | `model.scaffold`, `constraints.scaffold` |
| Run first assessment | `score.compute`, `report.generate`, `gate.evaluate` |
| See what still needs review | `review.list_unknowns` |
| Inspect extracted document evidence | `doc.extract_*` |
| Inspect trace linking | `trace.link_terms`, `trace.link_model_to_code` |
| Inspect history evidence | `history.*` |
| Advanced rollout operations | shadow rollout commands, self-measurement runbook |

## When You Are Done

You have reached a good stopping point when:

- README-level users can find the playbook quickly
- starter and authoritative runs are clearly separated
- curated inputs live beside the target repo
- observations are recorded only where they matter
- the assessment note explains the remaining unknowns

That is usually enough for a practical first adoption. You can continue later by
adding richer observations or tightening the curated model, but you do not need
to solve every unknown before the workflow becomes useful.
