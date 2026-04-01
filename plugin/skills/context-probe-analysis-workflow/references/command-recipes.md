# Command Recipes

Use these recipes after the preparation checklist is satisfied.

## Domain Design: First Run

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml
```

## Domain Design: With Docs

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

## Architecture Design: First Run

```bash
npx context-probe score.compute \
  --domain architecture_design \
  --repo fixtures/architecture/sample-repo \
  --constraints fixtures/architecture/constraints.yaml \
  --policy fixtures/policies/default.yaml
```

## Human-Readable Report

```bash
npx context-probe report.generate \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --format md
```

Switch `--domain` and input files to the architecture path when needed.

## Gate Evaluation

```bash
npx context-probe gate.evaluate \
  --domain architecture_design \
  --repo fixtures/architecture/sample-repo \
  --constraints fixtures/architecture/constraints.yaml \
  --policy fixtures/policies/default.yaml
```

## Review Queue

```bash
npx context-probe review.list_unknowns \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

## Extraction: Glossary

```bash
npx context-probe doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider codex
```

The same shape applies to:

- `doc.extract_rules`
- `doc.extract_invariants`

## Review Resolution Loop

Use this when review items were exported to JSON and the user wants to apply explicit human decisions:

```bash
npx context-probe review.resolve \
  --review-items path/to/review-items.json \
  --resolutions path/to/resolutions.json
```

Then rerun extraction with the generated review log:

```bash
npx context-probe doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider codex \
  --review-log path/to/review-log.json \
  --apply-review-log
```

## Self-Measurement for This Repository

### Domain design

```bash
npx context-probe score.compute \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

### Architecture design

```bash
npx context-probe score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml
```
