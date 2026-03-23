# Preparation

Use this reference before recommending any `context-probe` command.

## Prerequisite Checklist

- Node.js `>=24`
- repository cloned locally
- dependencies installed with `npm install`
- CLI available through either:
  - `npm run dev -- ...`
  - `node dist/src/cli.js ...` after `npm run build`

## Setup Commands

Use these when the project has not been prepared yet:

```bash
npm install
npm run build
npm run dev -- --help
```

## Path Selection

Choose the command family from the user’s goal:

- `domain_design`
  - requires `--model`
- `architecture_design`
  - requires `--constraints`
- extraction and review
  - requires `--docs-root`
  - usually also requires `--extractor cli` plus a provider such as `codex` or `claude`

## Important Caveats

- `--docs-root` is optional for some scoring flows, but document-based metrics may be skipped without it.
- Git-history-based signals can have lower confidence if the repository has little or no history.
- `doc.extract_*` is not the default first step for new users. Prefer core scoring first unless the user explicitly wants extraction.

## Good Default for This Repository

If the user wants to measure the `context_probe` repository itself, prefer the self-measurement configs:

- `config/self-measurement/domain-model.yaml`
- `config/self-measurement/architecture-constraints.yaml`
- `fixtures/policies/default.yaml`
