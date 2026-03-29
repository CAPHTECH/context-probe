# AI-Assisted Design Measurement Platform

- Version: v0.2
- Purpose: define the platform vision, principles, and scope

## Background

Design review tends to suffer from the same problems across domains.

1. Evaluation becomes overly subjective.
2. Code metrics alone cannot capture semantic boundaries, language integrity, invariant closure, or contract validity.
3. Design knowledge is fragmented across PRDs, ADRs, glossaries, code, issues, and history.
4. It is hard to explain what improved after refactoring.
5. Architecture review also becomes person-dependent when evidence is weak.

The platform does not ask AI to invent scores. It asks AI to extract evidence and then lets fixed formulas and deterministic analyzers evaluate that evidence.

## Vision

Move design discussion away from impression-driven debate and toward reproducible, evidence-backed measurement.

## Value

The platform does not compress design quality into one score. It decomposes quality into domains such as:

- domain design: language, boundaries, invariants, aggregates, evolution locality
- architecture design: dependency direction, boundary purity, contract stability, topology isolation

Users should be able to answer:

- what is weak
- why it is weak
- what evidence supports that conclusion

## Principles

1. AI is an evidence extractor, not the final judge.
2. The same input should produce the same result.
3. Every score must come with evidence, confidence, unknowns, and provenance.
4. Code alone is not enough to judge design intent.
5. Relative comparison matters more than absolute ranking.
6. Evaluation packs must remain extensible.

## Target Users

| User | Main Problem | Value |
|---|---|---|
| Architect | hard to justify boundary choices | evidence-backed candidate comparison |
| Tech Lead | review criteria drift between people | reusable measurement-based review |
| Domain Expert | hard to tell whether the model reflects reality | traceability across terms, rules, and invariants |
| Delivery Team | design erosion slips in over time | CI monitoring and PR-level comparison |
| Advisor / Auditor | hard to quantify improvement | baselines and trend views |

## Goals

- decompose design quality into multiple measurable dimensions
- extract evidence from documents, code, history, and operations
- compute scores through declarative policy and fixed formulas
- preserve evidence traceability
- support both greenfield and brownfield work
- support candidate comparison, diff comparison, and time-series comparison
- make it easy to add new evaluation packs

## Non-Goals

- letting AI fully decide the "right" design
- judging design with one total score only
- inferring complete design validity from code alone
- forcing one weight profile on every organization
- reusing design scores directly for people evaluation

## Scope

### Current Scope

- shared ingestion, normalization, traceability, and evidence handling
- domain design evaluation
- shared scoring, reporting, and CI integration

### Next Scope

- architecture design evaluation
- dependency direction
- boundary purity
- contract stability
- runtime topology isolation
- architecture evolution locality

### Future Scope

- operability design
- security design
- data design
- correlation analysis with delivery outcomes

## Evaluation-Pack Model

Each evaluation area sits on top of the shared platform as an evaluation pack.

| Domain ID | Area | Role | Status |
|---|---|---|---|
| `domain_design` | Domain Design | first detailed implementation target | specified |
| `architecture_design` | Architecture Design | next target | specified |
| `operability_design` | Operability Design | future | conceptual |
| `security_design` | Security Design | future | conceptual |

Each pack needs at least:

- target artifact definition
- AI extractors
- deterministic analyzers
- metric definitions
- mandatory review rules
- reporting rules

## Conceptual Flow

```text
Design artifacts / code / history / issues / operational data
  -> collection, normalization, structuring
  -> AI extraction, candidate generation, ambiguity detection
  -> deterministic dependency, history, and rule analysis
  -> fixed score functions
  -> evidence-backed reports, diffs, CI decisions, review queue
```

## Success Conditions

The platform is successful if:

1. reruns on the same input are stable
2. every score can be traced back to evidence
3. ambiguity is surfaced rather than hidden
4. design regression is visible through diffs and trends
5. new evaluation packs can be added without breaking the shared platform
