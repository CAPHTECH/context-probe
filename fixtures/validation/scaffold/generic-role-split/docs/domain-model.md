# Knowledge Substrate context

## Glossary

- `FactLedger` is the append-only canonical fact store in the Knowledge Substrate context.
- `APP_PORT` is a process environment variable, not a domain aggregate.
- `MODIFIED` is a git status marker, not a domain aggregate.
- `pnpm ingest:diff` is a maintenance command, not a domain aggregate.

## Rules

- In the Knowledge Substrate context, `FactLedger` must remain append-only.

# Query and Planning context

- `ChangePlanning` selects safe work before execution.

# Runtime and Surfaces context

- `AgentToolsAPI` exposes narrow runtime tools.

# Workspace and Bootstrap context

- `WorkspaceRegistry` manages project workspaces.

# Evaluation and Quality context

- `EvaluationBaseline` records review outcomes.
