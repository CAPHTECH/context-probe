# Architecture Design Metrics

Use this page for human interpretation of `architecture_design` metrics.

For conceptual formulas, read [../concepts/architecture-design.md](../concepts/architecture-design.md).
For the current CLI behavior, source precedence, and proxy handling, read [../implementation/architecture-design-measurement.md](../implementation/architecture-design-measurement.md).

## Overview

| Metric | Main question |
|---|---|
| `QSF` | Does this design fit the quality scenarios that matter for this system? |
| `PCS` | Does the implementation follow the chosen pattern's rules? |
| `OAS` | Does runtime behavior fulfill the promise of the pattern? |
| `EES` | Are delivery performance and locality both healthy? |
| `CTI` | Is the complexity tax proportionate to the gain? |
| `APSI` | How does one candidate compare to another after reading the supporting metrics? |

## `QSF`

Measures fit against the system's important quality scenarios.

Good state:

- top scenarios are prioritized
- target and worst acceptable values are defined
- observations can be tied back to those scenarios

Watch for:

- evaluation framed only as pattern preference
- missing targets or worst-case bounds
- many scenarios with no prioritization

Next action:

- define the top scenarios first
- normalize benchmark, SLO, and incident signals into scenario observations

## `PCS`

Measures whether the chosen architecture pattern is actually enforced.

Good state:

- pattern-specific rules are explicit
- those rules are checked continuously
- violations are observable rather than assumed away

Watch for:

- a pattern name without enforceable rules
- disciplined package layout with weak actual constraints
- contract drift with no CI protection

Next action:

- define rule sets per pattern family
- evaluate dependency direction, purity, and contract stability separately

## `OAS`

Measures whether runtime behavior fulfills the promise of the architecture pattern.

Good state:

- latency, error, and saturation are visible by traffic band
- pattern-specific runtime signals are also available
- runtime behavior does not undermine the chosen design

Watch for:

- acceptable generic ops with weak pattern-runtime signals
- reliance on bridge or neutral fallback values

Next action:

- normalize telemetry by traffic band
- add the minimum pattern-runtime observation set

## `EES`

Measures delivery performance together with historical locality.

Good state:

- lead time, recovery, and change-fail performance are healthy
- locality is healthy as well

Watch for:

- fast delivery that still requires wide coordinated changes
- good delivery signals with poor locality

Next action:

- inspect delivery and locality separately before acting
- review the highest cross-boundary co-change pairs

## `CTI`

Measures the operational and cognitive tax introduced by the chosen design.

Good state:

- deployables, pipelines, schemas, datastores, on-call surface, sync depth, and run cost are proportionate to team capacity and business need

Watch for:

- higher coordination cost with little measurable gain
- rising on-call or schema burden hidden behind architectural enthusiasm

Next action:

- start with deployables per team and on-call surface
- add missing complexity metadata to the evidence inputs

## Supporting Metrics

The current architecture reports often expose supporting metrics separately:

- `DDS`: dependency direction
- `BPS`: boundary purity
- `IPS`: interface stability
- `TIS`: topology-isolation bridge
- `AELS`: architecture change locality

Read them before trusting `APSI`.

## `APSI`

`APSI` is a summary-only comparison aid.

Use it only after reading:

- `QSF`
- `PCS` or its current supporting metrics
- `OAS`
- `EES`
- `CTI`

Do not use it as a standalone KPI.
