# Architecture Metric Mapping

- Version: v0.1
- Purpose: map the conceptual architecture model to the current implementation

## Top-Level Mapping

| Conceptual Metric | Role | Current Implementation | Status |
|---|---|---|---|
| `QSF` | scenario fit | `QSF` | partial |
| `PCS` | pattern rule conformance | `DDS`, `BPS`, `IPS` | implemented as proxy |
| `OAS` | runtime adequacy | `OAS`, `TIS` | partial |
| `EES` | delivery + locality | `AELS`, `EES` | partial |
| `CTI` | complexity tax | `CTI` | partial |
| `APSI` | summary index | `APSI` | partial |

## Current Metrics

### `DDS`

- role: dependency direction and layer compliance
- conceptual position: part of `PCS`

### `BPS`

- role: boundary purity and contamination control
- conceptual position: part of `PCS`

### `IPS`

- role: contract/interface stability
- conceptual position: part of `PCS`

### `TIS`

- role: topology isolation and runtime containment bridge
- conceptual position: bridge toward `OAS`

### `AELS`

- role: architecture change locality
- conceptual position: locality side of `EES`

## Notes

- `APSI` is intentionally summary-only
- `PCS` and `OAS` currently rely on proxy or fallback behavior in some cases
- improving evidence quality is more valuable than tuning summary weights too early
