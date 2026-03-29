# Shadow Rollout Manifests

These domain models are versioned evaluation manifests for external
repositories used during beta0 persistence shadow-rollout decisions.

- They are not production defaults.
- They are not fixture repos copied into this repository.
- They exist to make external-repo measurements reproducible without relying on
  ad hoc `/tmp` model files.
- Promotion from `shadow_only` to `replace` still depends on the real-repo
  adoption gate in `test/persistence-adoption.test.ts`.
- `registry.yaml` is the categorized source of truth for the current real-repo
  rollout observations.
- `batch-spec.example.yaml` is the starting point for a runnable multi-repo
  batch.

Current manifests:

- `sim_prism-domain-model.yaml`
- `pce-memory-domain-model.yaml`
- `zakki-domain-model.yaml`
- `assay-kit-domain-model.yaml`
- `project_logica-domain-model.yaml`
- `registry.yaml`
- `batch-spec.example.yaml`

The registry is a decision artifact, not an executable batch spec.

Typical usage:

```bash
npm run dev -- history.compare_locality_models \
  --repo /path/to/repo \
  --model fixtures/validation/shadow-rollout/sim_prism-domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

```bash
npm run dev -- score.compute \
  --repo /path/to/repo \
  --model fixtures/validation/shadow-rollout/pce-memory-domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --shadow-persistence
```

Batch observation example:

```bash
node dist/src/cli.js score.observe_shadow_rollout_batch \
  --batch-spec fixtures/validation/shadow-rollout/batch-spec.example.yaml
```

Gate evaluation example:

```bash
node dist/src/cli.js gate.evaluate_shadow_rollout \
  --registry fixtures/validation/shadow-rollout/registry.yaml
```

The gate output includes both the overall disposition and category-local decisions, so a repo typology can stay `replace` even while the global rollout remains `shadow_only`.

Batch spec shape:

```yaml
version: "1.0"
tieTolerance: 0.02
entries:
  - repoId: sim_prism
    label: "Sim Prism"
    category: "application"
    repo: /absolute/path/to/sim_prism
    model: fixtures/validation/shadow-rollout/sim_prism-domain-model.yaml
    policy: ../../policies/default.yaml
  - repoId: pce-memory
    label: "PCE Memory"
    category: "tooling"
    repo: /absolute/path/to/pce-memory
    model: fixtures/validation/shadow-rollout/pce-memory-domain-model.yaml
    policy: ../../policies/default.yaml
  - repoId: zakki
    label: "Zakki"
    category: "application"
    repo: /absolute/path/to/zakki
    model: fixtures/validation/shadow-rollout/zakki-domain-model.yaml
    policy: ../../policies/default.yaml
  - repoId: assay-kit
    label: "Assay Kit"
    category: "tooling"
    repo: /absolute/path/to/assay-kit
    model: fixtures/validation/shadow-rollout/assay-kit-domain-model.yaml
    policy: ../../policies/default.yaml
  - repoId: project_logica
    label: "Project Logica"
    category: "tooling"
    repo: /absolute/path/to/project_logica
    model: fixtures/validation/shadow-rollout/project_logica-domain-model.yaml
    policy: ../../policies/default.yaml
```
