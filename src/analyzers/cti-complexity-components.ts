import type { ArchitectureConstraints, CodebaseAnalysis } from "../core/contracts.js";
import { collectContractFilePaths } from "./contract-files.js";
import type { ComplexityTaxRecorder } from "./cti-complexity-recorder.js";

interface ComplexityTaxComponentContext {
  constraints: ArchitectureConstraints;
  metadata: ArchitectureConstraints["complexity"];
  recorder: ComplexityTaxRecorder;
}

function recordConstraintComponent(
  recorder: ComplexityTaxRecorder,
  input: {
    component:
      | "DeployablesPerTeam"
      | "PipelinesPerDeployable"
      | "DatastoresPerServiceGroup"
      | "OnCallSurface"
      | "SyncDepthOverhead"
      | "RunCostPerBusinessTransaction";
    kind:
      | "deployables_per_team"
      | "pipelines_per_deployable"
      | "datastores_per_service_group"
      | "oncall_surface"
      | "sync_depth_overhead"
      | "run_cost_per_business_transaction";
    observed: number | undefined;
    note: string;
    missingUnknown: string;
  },
): void {
  recorder.recordObservedComponent({
    ...input,
    source: "constraints",
  });
}

export function recordComplexityTaxComponents(options: {
  codebase: CodebaseAnalysis;
  context: ComplexityTaxComponentContext;
}): void {
  const { codebase, context } = options;
  const { metadata, recorder } = context;
  const deployableCount = metadata?.deployableCount;
  const teamCount = metadata?.teamCount;

  recordConstraintComponent(recorder, {
    component: "DeployablesPerTeam",
    kind: "deployables_per_team",
    observed:
      deployableCount !== undefined && teamCount !== undefined && teamCount > 0
        ? deployableCount / teamCount
        : undefined,
    note: "Evaluating deployables per team as a complexity-tax component.",
    missingUnknown: "DeployablesPerTeam cannot be approximated because teamCount or deployableCount is missing.",
  });

  recordConstraintComponent(recorder, {
    component: "PipelinesPerDeployable",
    kind: "pipelines_per_deployable",
    observed:
      metadata?.pipelineCount !== undefined && deployableCount !== undefined && deployableCount > 0
        ? metadata.pipelineCount / deployableCount
        : undefined,
    note: "Evaluating pipelines per deployable as a complexity-tax component.",
    missingUnknown:
      "PipelinesPerDeployable cannot be approximated because pipelineCount or deployableCount is missing.",
  });

  const observedContractCount =
    metadata?.contractOrSchemaCount ??
    collectContractFilePaths({
      codebase,
      constraints: context.constraints,
      allowDartDomainFallback: false,
    }).length;
  const serviceCount = metadata?.serviceCount ?? metadata?.deployableCount;
  recorder.recordObservedComponent({
    component: "ContractsOrSchemasPerService",
    kind: "contracts_or_schemas_per_service",
    observed: serviceCount !== undefined && serviceCount > 0 ? observedContractCount / serviceCount : undefined,
    source: metadata?.contractOrSchemaCount !== undefined ? "constraints" : "codebase",
    note: "Evaluating contracts or schemas per service as a complexity-tax component.",
    missingUnknown:
      "ContractsOrSchemasPerService cannot be approximated because serviceCount or deployableCount is missing.",
  });
  if (metadata?.contractOrSchemaCount === undefined && observedContractCount === 0) {
    recorder.noteUnknown("Contract/schema observations are sparse, so ContractsOrSchemasPerService is conservative.");
  }

  recordConstraintComponent(recorder, {
    component: "DatastoresPerServiceGroup",
    kind: "datastores_per_service_group",
    observed:
      metadata?.datastoreCount !== undefined &&
      metadata?.serviceGroupCount !== undefined &&
      metadata.serviceGroupCount > 0
        ? metadata.datastoreCount / metadata.serviceGroupCount
        : undefined,
    note: "Evaluating datastores per service group as a complexity-tax component.",
    missingUnknown:
      "DatastoresPerServiceGroup cannot be approximated because datastoreCount or serviceGroupCount is missing.",
  });

  recordConstraintComponent(recorder, {
    component: "OnCallSurface",
    kind: "oncall_surface",
    observed:
      metadata?.onCallSurface !== undefined && teamCount !== undefined && teamCount > 0
        ? metadata.onCallSurface / teamCount
        : undefined,
    note: "Evaluating on-call surface per team as a complexity-tax component.",
    missingUnknown: "OnCallSurface cannot be approximated because onCallSurface or teamCount is missing.",
  });

  recordConstraintComponent(recorder, {
    component: "SyncDepthOverhead",
    kind: "sync_depth_overhead",
    observed: metadata?.syncDepthP95,
    note: "Evaluating p95 synchronous hop depth as a complexity-tax component.",
    missingUnknown: "SyncDepthOverhead cannot be approximated because syncDepthP95 is missing.",
  });

  recordConstraintComponent(recorder, {
    component: "RunCostPerBusinessTransaction",
    kind: "run_cost_per_business_transaction",
    observed: metadata?.runCostPerBusinessTransaction,
    note: "Evaluating run cost per business transaction as a complexity-tax component.",
    missingUnknown:
      "RunCostPerBusinessTransaction cannot be approximated because runCostPerBusinessTransaction is missing.",
  });
}
