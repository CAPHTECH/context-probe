# Architecture Pattern Profiles

## Purpose

This document explains how different pattern families should shift emphasis when interpreting architecture scores.

The formulas for supporting metrics remain stable, but summary weighting and interpretation differ by pattern family.

## Shared Rule

All profiles still use the same top-level idea:

- reward scenario fit
- reward real conformance
- reward runtime adequacy
- reward evolution efficiency
- subtract complexity tax

## Layered / Clean / Hexagonal

Primary focus:

- `QSF`
- `PCS`

Why:

- the main gain comes from dependency discipline and domain isolation
- runtime complexity is usually not the main differentiator

Suggested summary bias:

```text
0.35*QSF + 0.30*PCS + 0.15*OAS + 0.10*EES + 0.10*(1-CTI)
```

## Service-Based / Microservices

Primary focus:

- `EES`
- `CTI`

Why:

- the core question is whether you truly gained change locality and deploy independence
- distributed-systems tax must stay visible

Suggested summary bias:

```text
0.20*QSF + 0.20*PCS + 0.15*OAS + 0.25*EES + 0.20*(1-CTI)
```

## CQRS

Primary focus:

- `QSF`
- `OAS`
- `CTI`

Why:

- the trade-off lives in invariant handling, freshness, replay, and operational complexity

Suggested summary bias:

```text
0.30*QSF + 0.15*PCS + 0.25*OAS + 0.10*EES + 0.20*(1-CTI)
```

## Event-Driven

Primary focus:

- `OAS`
- `CTI`

Why:

- success depends heavily on schema compatibility, lag, replay, idempotency, and operational burden

Suggested summary bias:

```text
0.20*QSF + 0.15*PCS + 0.30*OAS + 0.10*EES + 0.25*(1-CTI)
```

## Practical Rule

Use profiles to compare candidates under the same system constraints. Do not use them to claim one architecture style is universally better than another.
