# Domain context

## Glossary

- `FactLedger` is the append-only canonical fact store in the Domain context.
- `APP_PORT` is a process environment variable, not a domain aggregate.
- `MODIFIED` is a git status marker, not a domain aggregate.
- `pnpm ingest:diff` is a maintenance command, not a domain aggregate.

## Rules

- In the Domain context, `FactLedger` must remain append-only.
