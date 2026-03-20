# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the TypeScript CLI implementation. Use `src/cli.ts` as the entry point, `src/commands.ts` for command orchestration, `src/core/` for shared models and scoring/reporting logic, `src/analyzers/` for deterministic analysis, and `src/packs/` for domain-pack registration. `test/` holds Vitest suites, including fixture-backed integration tests. `fixtures/` contains sample repos, policies, and models used by tests. `docs/` is the product and architecture source of truth. `config/self-measurement/` stores configs for scoring this repository itself.

## Build, Test, and Development Commands

- `npm install`: install dependencies for Node 24+.
- `npm run build`: compile TypeScript to `dist/`.
- `npm run check`: run strict type-checking without emitting files.
- `npm test`: run the full Vitest suite once.
- `npm run test:watch`: run tests in watch mode while developing.
- `npm run dev -- --help`: run the CLI from source with `tsx`.

Example:

```bash
npm run dev -- score.compute --domain domain_design --repo . --model config/self-measurement/domain-model.yaml --policy fixtures/policies/default.yaml
```

## Coding Style & Naming Conventions

Follow the existing TypeScript style: ES modules, double quotes, semicolons, and 2-space indentation. Keep public contracts explicit in `src/core/contracts.ts`, and prefer small pure functions in `src/core/` or `src/analyzers/`. Use `camelCase` for functions and variables, `PascalCase` for types/interfaces, and `UPPER_SNAKE_CASE` for exported constants like fixture roots. Match command names to the existing dotted pattern such as `score.compute` or `doc.extract_glossary`.

## Testing Guidelines

Vitest is the test framework. Add or update tests for every behavioral change, especially command responses, scoring logic, and fixture-driven analysis flows. Keep test files named `*.test.ts` under `test/`. Reuse `test/helpers.ts` for temporary repos and fixture setup instead of duplicating shell logic. Run `npm run check && npm test` before opening a PR.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `test:`, and `chore:`. Keep commit messages imperative and scoped to one logical change. Pull requests should include a short summary, linked issue if applicable, affected commands or metrics, and the verification steps you ran. Include sample CLI output only when it clarifies behavior; screenshots are usually unnecessary for this CLI-first repository.

## Architecture & Configuration Notes

Preserve the docs-first split between AI-assisted extraction and deterministic analysis described in `docs/platform/runtime-and-commands.md`. Do not edit `dist/` by hand; change `src/` and rebuild. Treat `docs/` and fixture YAML files as compatibility surfaces because tests and self-measurement flows depend on them.
