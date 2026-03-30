import path from "node:path";

export const DDS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/dds/constraints.yaml");
export const DDS_GOOD_REPO = path.resolve("fixtures/validation/scoring/dds/good-repo");
export const DDS_BAD_REPO = path.resolve("fixtures/validation/scoring/dds/bad-repo");
export const BPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/bps/constraints.yaml");
export const BPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/bps/good-repo");
export const BPS_BAD_REPO = path.resolve("fixtures/validation/scoring/bps/bad-repo");
export const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
export const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
export const IPS_BAD_REPO = path.resolve("fixtures/validation/scoring/ips/bad-repo");
export const IPS_BASELINE_PATH = path.resolve("fixtures/examples/architecture-sources/contract-baseline.yaml");
export const IPS_BASELINE_SOURCE_FILE_PATH = path.resolve(
  "fixtures/examples/architecture-sources/contract-baseline-source.file.yaml",
);
export const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
export const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
export const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
export const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
export const CTI_GOOD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-good-complexity.yaml");
export const CTI_BAD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-bad-complexity.yaml");
export const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
export const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
export const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
export const QSF_GOOD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/good-observations.yaml");
export const QSF_BAD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/bad-observations.yaml");
export const QSF_THIN_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/thin-observations.yaml");
export const APSI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/good-constraints.yaml");
export const APSI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/bad-constraints.yaml");
export const APSI_FORMULAS = {
  default: { QSF: 0.3, PCS: 0.2, OAS: 0.2, EES: 0.15, CTI: 0.15 },
  layered: { QSF: 0.35, PCS: 0.3, OAS: 0.15, EES: 0.1, CTI: 0.1 },
  service_based: { QSF: 0.2, PCS: 0.2, OAS: 0.15, EES: 0.25, CTI: 0.2 },
  cqrs: { QSF: 0.3, PCS: 0.15, OAS: 0.25, EES: 0.1, CTI: 0.2 },
  event_driven: { QSF: 0.2, PCS: 0.15, OAS: 0.3, EES: 0.1, CTI: 0.25 },
} as const;
export const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
export const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
export const TIS_GOOD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/good-topology.yaml");
export const TIS_BAD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/bad-topology.yaml");
export const TIS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/good-runtime.yaml");
export const TIS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/bad-runtime.yaml");
export const OAS_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/good-telemetry.yaml");
export const OAS_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/bad-telemetry.yaml");
export const OAS_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/thin-telemetry.yaml");
export const OAS_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/oas/raw-normalization-profile.yaml");
export const OAS_RAW_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-good-telemetry.yaml");
export const OAS_RAW_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-bad-telemetry.yaml");
export const OAS_RAW_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-thin-telemetry.yaml");
export const OAS_EXPORT_GOOD_TELEMETRY_PATH = path.resolve(
  "fixtures/validation/scoring/oas/export-good-telemetry.yaml",
);
export const OAS_EXPORT_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/export-bad-telemetry.yaml");
export const OAS_EXPORT_THIN_TELEMETRY_PATH = path.resolve(
  "fixtures/validation/scoring/oas/export-thin-telemetry.yaml",
);
export const OAS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/good-runtime.yaml");
export const OAS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/bad-runtime.yaml");
export const OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-good-runtime.yaml",
);
export const OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-bad-runtime.yaml",
);
export const OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-good-runtime.yaml",
);
export const OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-bad-runtime.yaml",
);
export const OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-good-runtime.yaml",
);
export const OAS_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-bad-runtime.yaml",
);
export const OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-good-runtime.yaml",
);
export const OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-bad-runtime.yaml",
);
export const OAS_FAMILY_THIN_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/family-thin-runtime.yaml");
export const OAS_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-mismatch-runtime.yaml",
);
export const OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-pattern-runtime-normalization-profile.yaml",
);
export const OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-good-runtime.yaml",
);
export const OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-bad-runtime.yaml",
);
export const OAS_RAW_FAMILY_THIN_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-thin-runtime.yaml",
);
export const OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-mismatch-runtime.yaml",
);
export const AELS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/aels/constraints.yaml");
export const AELS_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/aels/boundary-map.yaml");
export const AELS_BASE_ENTRY = "fixtures/validation/scoring/aels/base-repo";
export const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
export const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
export const EES_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/good-delivery.yaml");
export const EES_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/bad-delivery.yaml");
export const EES_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/ees/raw-normalization-profile.yaml");
export const EES_RAW_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-good-delivery.yaml");
export const EES_RAW_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-bad-delivery.yaml");
export const EES_RAW_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-thin-delivery.yaml");
export const EES_EXPORT_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-good-delivery.yaml");
export const EES_EXPORT_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-bad-delivery.yaml");
export const EES_EXPORT_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-thin-delivery.yaml");
export const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";
