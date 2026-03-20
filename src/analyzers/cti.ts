import type {
  ArchitectureConstraints,
  CodebaseAnalysis,
  ComplexityTaxBaseline,
  ComplexityTaxComponentName
} from "../core/contracts.js";
import { collectContractFilePaths } from "./contract-files.js";

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

const DEFAULT_BASELINES: Record<ComplexityTaxComponentName, Required<ComplexityTaxBaseline>> = {
  DeployablesPerTeam: { target: 1, worst: 8 },
  PipelinesPerDeployable: { target: 1, worst: 6 },
  ContractsOrSchemasPerService: { target: 2, worst: 20 },
  DatastoresPerServiceGroup: { target: 1, worst: 5 },
  OnCallSurface: { target: 2, worst: 20 },
  SyncDepthOverhead: { target: 1, worst: 6 },
  RunCostPerBusinessTransaction: { target: 1, worst: 10 }
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBaseline(
  constraints: ArchitectureConstraints,
  component: ComplexityTaxComponentName
): Required<ComplexityTaxBaseline> {
  const override = constraints.complexity?.normalization?.[component];
  return {
    target: override?.target ?? DEFAULT_BASELINES[component].target,
    worst: override?.worst ?? DEFAULT_BASELINES[component].worst
  };
}

function normalizeTax(value: number, baseline: Required<ComplexityTaxBaseline>): number {
  if (value <= baseline.target) {
    return 0;
  }
  if (value >= baseline.worst) {
    return 1;
  }
  return clamp01((value - baseline.target) / Math.max(0.0001, baseline.worst - baseline.target));
}

function uniqueUnknowns(entries: string[]): string[] {
  return Array.from(new Set(entries));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
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
    RunCostPerBusinessTransaction: 0.5
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
    const sourceConfidence =
      input.source === "constraints" ? 0.88 : input.source === "codebase" ? 0.72 : 0.6;
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
      note: `${input.note} (observed=${round(input.observed)}, target=${baseline.target}, worst=${baseline.worst})`
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
    note: "deployables per team を complexity tax として評価しています",
    missingUnknown: "teamCount または deployableCount が不足しており DeployablesPerTeam は近似できません"
  });

  recordObservedComponent({
    component: "PipelinesPerDeployable",
    kind: "pipelines_per_deployable",
    observed:
      metadata?.pipelineCount !== undefined && deployableCount !== undefined && deployableCount > 0
        ? metadata.pipelineCount / deployableCount
        : undefined,
    source: "constraints",
    note: "pipelines per deployable を complexity tax として評価しています",
    missingUnknown: "pipelineCount または deployableCount が不足しており PipelinesPerDeployable は近似できません"
  });

  const observedContractCount =
    metadata?.contractOrSchemaCount
    ?? collectContractFilePaths({
      codebase,
      constraints,
      allowDartDomainFallback: false
    }).length;
  const serviceCount = metadata?.serviceCount ?? metadata?.deployableCount;
  recordObservedComponent({
    component: "ContractsOrSchemasPerService",
    kind: "contracts_or_schemas_per_service",
    observed: serviceCount !== undefined && serviceCount > 0 ? observedContractCount / serviceCount : undefined,
    source: metadata?.contractOrSchemaCount !== undefined ? "constraints" : "codebase",
    note: "contracts or schemas per service を complexity tax として評価しています",
    missingUnknown:
      "serviceCount または deployableCount が不足しており ContractsOrSchemasPerService は近似できません"
  });
  if (metadata?.contractOrSchemaCount === undefined && observedContractCount === 0) {
    unknowns.push("contract/schema の観測が少なく ContractsOrSchemasPerService は保守的な近似です");
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
    note: "datastores per service group を complexity tax として評価しています",
    missingUnknown:
      "datastoreCount または serviceGroupCount が不足しており DatastoresPerServiceGroup は近似できません"
  });

  recordObservedComponent({
    component: "OnCallSurface",
    kind: "oncall_surface",
    observed:
      metadata?.onCallSurface !== undefined && teamCount !== undefined && teamCount > 0
        ? metadata.onCallSurface / teamCount
        : undefined,
    source: "constraints",
    note: "on-call surface per team を complexity tax として評価しています",
    missingUnknown: "onCallSurface または teamCount が不足しており OnCallSurface は近似できません"
  });

  recordObservedComponent({
    component: "SyncDepthOverhead",
    kind: "sync_depth_overhead",
    observed: metadata?.syncDepthP95,
    source: "constraints",
    note: "p95 synchronous hop depth を complexity tax として評価しています",
    missingUnknown: "syncDepthP95 が不足しており SyncDepthOverhead は近似できません"
  });

  recordObservedComponent({
    component: "RunCostPerBusinessTransaction",
    kind: "run_cost_per_business_transaction",
    observed: metadata?.runCostPerBusinessTransaction,
    source: "constraints",
    note: "run cost per business transaction を complexity tax として評価しています",
    missingUnknown:
      "runCostPerBusinessTransaction が不足しており RunCostPerBusinessTransaction は近似できません"
  });

  if (!metadata) {
    unknowns.push("constraints に complexity metadata がなく CTI は部分的にしか観測できません");
  }
  if (recorded.size < 4) {
    unknowns.push("観測できた complexity tax component が少なく CTI の信頼度は限定的です");
  }

  return {
    components,
    confidence: clamp01(average(confidenceSignals, 0.45)),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}
