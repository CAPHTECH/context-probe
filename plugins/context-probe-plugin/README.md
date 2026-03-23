# Context Probe Plugin

Claude Code plugin for using `context-probe` end to end in English.

## What It Adds

- `context-probe-workflow`
  - Guides setup and prerequisite checks
  - Recommends the right `context-probe` commands for scoring and extraction
  - Interprets `status`, `confidence`, `unknowns`, `diagnostics`, and `provenance`
  - Investigates whether results are trustworthy
  - Produces a final summary and confirms whether findings should be turned into issues

## Repository Layout

```text
.claude-plugin/marketplace.json
.claude/settings.json
plugins/context-probe-plugin/
```

The repository root is the marketplace. The plugin itself lives under `plugins/context-probe-plugin`.

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
  plugins/context-probe-plugin/skills/context-probe-workflow
```

Load the plugin directly during development:

```bash
claude --plugin-dir ./plugins/context-probe-plugin
```

Then reload changes from inside Claude Code with:

```text
/reload-plugins
```

## Usage

Ask Claude Code in English for flows such as:

- "Use context-probe on this repository"
- "Measure this repo with context-probe"
- "Analyze this context-probe report"
- "Investigate whether this context-probe result is correct"

The skill is designed to start with the smallest useful command path and only expand into extraction and review commands when needed.
