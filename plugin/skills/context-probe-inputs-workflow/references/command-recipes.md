# Command Recipes

Use these recipes when the inputs workflow needs an exact `context-probe` invocation shape.

All examples use the published CLI entry point:

```bash
npx context-probe ...
```

Do not switch to `npm run dev -- ...` for this skill.

## Scaffold: Domain Model

```bash
npx context-probe model.scaffold \
  --repo /path/to/repo
```

Add docs when the repository has maintained docs:

```bash
npx context-probe model.scaffold \
  --repo /path/to/repo \
  --docs-root docs
```

## Scaffold: Architecture Constraints

```bash
npx context-probe constraints.scaffold \
  --repo /path/to/repo
```

## Starter Run: Domain Design

Use this both for first-time setup and for updates to an existing curated domain model.

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo /path/to/repo \
  --model docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

Add docs when the curated run expects them:

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo /path/to/repo \
  --model docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

## Starter Run: Architecture Design

Use this both for first-time setup and for updates to existing curated architecture inputs.

```bash
npx context-probe score.compute \
  --domain architecture_design \
  --repo /path/to/repo \
  --constraints docs/architecture/context-probe/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml
```

## Authoritative Run: Domain Design

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo /path/to/repo \
  --model docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

## Authoritative Run: Architecture Design

Use bundle inputs only after the related observation snapshots are maintained.

```bash
npx context-probe score.compute \
  --domain architecture_design \
  --repo /path/to/repo \
  --constraints docs/architecture/context-probe/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml
```

## Review Unknowns During Input Curation

```bash
npx context-probe review.list_unknowns \
  --domain domain_design \
  --repo /path/to/repo \
  --model docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```
