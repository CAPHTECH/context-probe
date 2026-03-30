import type { ArchitectureConstraints, ComplexityTaxComponentName } from "../core/contracts.js";
import { average, clamp01, getBaseline, normalizeTax, round, uniqueUnknowns } from "./cti-helpers.js";

export interface ComplexityTaxFinding {
  component: ComplexityTaxComponentName;
  kind:
    | "deployables_per_team"
    | "pipelines_per_deployable"
    | "contracts_or_schemas_per_service"
    | "datastores_per_service_group"
    | "oncall_surface"
    | "sync_depth_overhead"
    | "run_cost_per_business_transaction";
  observed: number;
  normalized: number;
  confidence: number;
  source: "constraints" | "codebase" | "derived";
  note: string;
}

export interface ComplexityTaxScore {
  components: Record<ComplexityTaxComponentName, number>;
  confidence: number;
  unknowns: string[];
  findings: ComplexityTaxFinding[];
}

export interface ComplexityTaxObservationInput {
  component: ComplexityTaxComponentName;
  kind: ComplexityTaxFinding["kind"];
  observed: number | undefined;
  source: ComplexityTaxFinding["source"];
  note: string;
  missingUnknown: string;
}

export interface ComplexityTaxRecorder {
  components: Record<ComplexityTaxComponentName, number>;
  recordObservedComponent(input: ComplexityTaxObservationInput): void;
  noteUnknown(message: string): void;
  finalize(): ComplexityTaxScore;
}

export function createComplexityTaxRecorder(constraints: ArchitectureConstraints): ComplexityTaxRecorder {
  const findings: ComplexityTaxFinding[] = [];
  const unknowns: string[] = [];
  const confidenceSignals: number[] = [];
  const components: Record<ComplexityTaxComponentName, number> = {
    DeployablesPerTeam: 0.5,
    PipelinesPerDeployable: 0.5,
    ContractsOrSchemasPerService: 0.5,
    DatastoresPerServiceGroup: 0.5,
    OnCallSurface: 0.5,
    SyncDepthOverhead: 0.5,
    RunCostPerBusinessTransaction: 0.5,
  };
  const recorded = new Set<ComplexityTaxComponentName>();

  function recordObservedComponent(input: ComplexityTaxObservationInput): void {
    if (input.observed === undefined || !Number.isFinite(input.observed)) {
      unknowns.push(input.missingUnknown);
      confidenceSignals.push(0.4);
      return;
    }
    const baseline = getBaseline(constraints, input.component);
    const normalized = normalizeTax(input.observed, baseline);
    const sourceConfidence = input.source === "constraints" ? 0.88 : input.source === "codebase" ? 0.72 : 0.6;
    components[input.component] = normalized;
    confidenceSignals.push(sourceConfidence);
    recorded.add(input.component);
    findings.push({
      component: input.component,
      kind: input.kind,
      observed: round(input.observed),
      normalized: round(normalized),
      confidence: sourceConfidence,
      source: input.source,
      note: `${input.note} (observed=${round(input.observed)}, target=${baseline.target}, worst=${baseline.worst})`,
    });
  }

  function noteUnknown(message: string): void {
    unknowns.push(message);
  }

  function finalize(): ComplexityTaxScore {
    if (recorded.size < 4) {
      unknowns.push("Too few complexity-tax components were observed, so CTI confidence is limited.");
    }
    return {
      components,
      confidence: clamp01(average(confidenceSignals, 0.45)),
      unknowns: uniqueUnknowns(unknowns),
      findings,
    };
  }

  return {
    components,
    recordObservedComponent,
    noteUnknown,
    finalize,
  };
}
