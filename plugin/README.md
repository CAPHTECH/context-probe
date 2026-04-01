# Context Probe Plugin

Claude Code plugin with reusable `context-probe` skills.

## What It Adds

- `context-probe-inputs-workflow`
  - Supports scaffold-first YAML input setup for applying `context-probe` to an existing repository
  - Helps curate starter inputs, observation templates, and assessment updates
  - Uses `plugin/scripts/context_probe_inputs_paths.py` to suggest stable paths and worktree names
- `context-probe-analysis-workflow`
  - Runs `score.compute`, `report.generate`, `gate.evaluate`, and `review.list_unknowns` after curated inputs exist
  - Digs into `doc.extract_*`, `trace.*`, `history.*`, and `review.resolve` only when results need deeper inspection
  - Interprets confidence, unknowns, diagnostics, and provenance before recommending next steps

## Repository Layout

```text
.claude-plugin/marketplace.json
.claude/settings.json
plugin/
```

The repository root is the marketplace. The plugin itself lives under `plugin/`.

## Team Installation

This repository ships a committed `.claude/settings.json` that:

- registers `context-probe-marketplace`
- enables `context-probe-plugin@context-probe-marketplace`

When collaborators trust the repository in Claude Code, they should be prompted to install the marketplace and plugin automatically.

## Manual Installation

From Claude Code in this repository:

```text
/plugin marketplace add .
/plugin install context-probe-plugin@context-probe-marketplace
/plugin enable context-probe-plugin@context-probe-marketplace
```

## Local Development

Validate the marketplace:

```bash
claude plugin validate .
```

Validate the skill:

```bash
python3 /Users/rizumita/.codex/skills/skill-creator/scripts/validate_skill.py \
  plugin/skills/context-probe-inputs-workflow
python3 /Users/rizumita/.codex/skills/skill-creator/scripts/validate_skill.py \
  plugin/skills/context-probe-analysis-workflow
```

Load the plugin directly during development:

```bash
claude --plugin-dir ./plugin
```

Then reload changes from inside Claude Code with:

```text
/reload-plugins
```

## Usage

Ask Claude Code in English for flows such as:

- "Apply context-probe to this repository"
- "Run context-probe on this repo"
- "Analyze this context-probe result"
- "Inspect the unknowns in this score"

Use the inputs workflow first when the repo still needs maintained YAML. Use the analysis workflow after those inputs exist and you want an actual measurement or investigation loop.

The analysis workflow recipes assume the published CLI entry point via `npx context-probe ...`, not `npm run dev -- ...` from this repository checkout.

For Codex, install or reference the skills directly from `plugin/skills/` rather than packaging a separate Codex plugin.
