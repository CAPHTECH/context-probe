import type { ArchitectureConstraints, CodebaseAnalysis, ComplexityTaxComponentName } from "../core/contracts.js";
import { collectContractFilePaths } from "./contract-files.js";
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

export function scoreComplexityTax(options: {
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
}): ComplexityTaxScore {
  const { codebase, constraints } = options;
  const metadata = constraints.complexity;
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

  function recordObservedComponent(input: {
    component: ComplexityTaxComponentName;
    kind: ComplexityTaxFinding["kind"];
    observed: number | undefined;
    source: ComplexityTaxFinding["source"];
    note: string;
    missingUnknown: string;
  }): void {
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

  const deployableCount = metadata?.deployableCount;
  const teamCount = metadata?.teamCount;
  recordObservedComponent({
    component: "DeployablesPerTeam",
    kind: "deployables_per_team",
    observed:
      deployableCount !== undefined && teamCount !== undefined && teamCount > 0
        ? deployableCount / teamCount
        : undefined,
    source: "constraints",
    note: "Evaluating deployables per team as a complexity-tax component.",
    missingUnknown: "DeployablesPerTeam cannot be approximated because teamCount or deployableCount is missing.",
  });

  recordObservedComponent({
    component: "PipelinesPerDeployable",
    kind: "pipelines_per_deployable",
    observed:
      metadata?.pipelineCount !== undefined && deployableCount !== undefined && deployableCount > 0
        ? metadata.pipelineCount / deployableCount
        : undefined,
    source: "constraints",
    note: "Evaluating pipelines per deployable as a complexity-tax component.",
    missingUnknown:
      "PipelinesPerDeployable cannot be approximated because pipelineCount or deployableCount is missing.",
  });

  const observedContractCount =
    metadata?.contractOrSchemaCount ??
    collectContractFilePaths({
      codebase,
      constraints,
      allowDartDomainFallback: false,
    }).length;
  const serviceCount = metadata?.serviceCount ?? metadata?.deployableCount;
  recordObservedComponent({
    component: "ContractsOrSchemasPerService",
    kind: "contracts_or_schemas_per_service",
    observed: serviceCount !== undefined && serviceCount > 0 ? observedContractCount / serviceCount : undefined,
    source: metadata?.contractOrSchemaCount !== undefined ? "constraints" : "codebase",
    note: "Evaluating contracts or schemas per service as a complexity-tax component.",
    missingUnknown:
      "ContractsOrSchemasPerService cannot be approximated because serviceCount or deployableCount is missing.",
  });
  if (metadata?.contractOrSchemaCount === undefined && observedContractCount === 0) {
    unknowns.push("Contract/schema observations are sparse, so ContractsOrSchemasPerService is conservative.");
  }

  recordObservedComponent({
    component: "DatastoresPerServiceGroup",
    kind: "datastores_per_service_group",
    observed:
      metadata?.datastoreCount !== undefined &&
      metadata?.serviceGroupCount !== undefined &&
      metadata.serviceGroupCount > 0
        ? metadata.datastoreCount / metadata.serviceGroupCount
        : undefined,
    source: "constraints",
    note: "Evaluating datastores per service group as a complexity-tax component.",
    missingUnknown:
      "DatastoresPerServiceGroup cannot be approximated because datastoreCount or serviceGroupCount is missing.",
  });

  recordObservedComponent({
    component: "OnCallSurface",
    kind: "oncall_surface",
    observed:
      metadata?.onCallSurface !== undefined && teamCount !== undefined && teamCount > 0
        ? metadata.onCallSurface / teamCount
        : undefined,
    source: "constraints",
    note: "Evaluating on-call surface per team as a complexity-tax component.",
    missingUnknown: "OnCallSurface cannot be approximated because onCallSurface or teamCount is missing.",
  });

  recordObservedComponent({
    component: "SyncDepthOverhead",
    kind: "sync_depth_overhead",
    observed: metadata?.syncDepthP95,
    source: "constraints",
    note: "Evaluating p95 synchronous hop depth as a complexity-tax component.",
    missingUnknown: "SyncDepthOverhead cannot be approximated because syncDepthP95 is missing.",
  });

  recordObservedComponent({
    component: "RunCostPerBusinessTransaction",
    kind: "run_cost_per_business_transaction",
    observed: metadata?.runCostPerBusinessTransaction,
    source: "constraints",
    note: "Evaluating run cost per business transaction as a complexity-tax component.",
    missingUnknown:
      "RunCostPerBusinessTransaction cannot be approximated because runCostPerBusinessTransaction is missing.",
  });

  if (!metadata) {
    unknowns.push("Constraints do not include complexity metadata, so CTI is only partially observed.");
  }
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
