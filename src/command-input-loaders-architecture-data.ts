import { loadOptionalDataFile } from "./command-input-loaders-core.js";
import type { CommandArgs } from "./command-path-helpers.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  CommandContext,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./core/contracts.js";

export function loadScenarioCatalogIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureScenarioCatalog>(args, "scenario-catalog", context);
}

export function loadScenarioObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ScenarioObservationSet>(args, "scenario-observations", context);
}

export function loadTopologyModelIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTopologyModel>(args, "topology-model", context);
}

export function loadBoundaryMapIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureBoundaryMap>(args, "boundary-map", context);
}

export function loadContractBaselineIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureContractBaseline>(args, "contract-baseline", context);
}

export function loadRuntimeObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<TopologyRuntimeObservationSet>(args, "runtime-observations", context);
}

export function loadDeliveryObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryObservationSet>(args, "delivery-observations", context);
}

export function loadDeliveryRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryRawObservationSet>(args, "delivery-raw-observations", context);
}

export function loadDeliveryExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureDeliveryExportBundle>(args, "delivery-export", context);
}

export function loadTelemetryObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryObservationSet>(args, "telemetry-observations", context);
}

export function loadTelemetryRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryRawObservationSet>(args, "telemetry-raw-observations", context);
}

export function loadTelemetryExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureTelemetryExportBundle>(args, "telemetry-export", context);
}

export function loadPatternRuntimeObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitecturePatternRuntimeObservationSet>(args, "pattern-runtime-observations", context);
}

export function loadPatternRuntimeRawObservationsIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitecturePatternRuntimeRawObservationSet>(
    args,
    "pattern-runtime-raw-observations",
    context,
  );
}

export function loadComplexityExportIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ArchitectureComplexityExportBundle>(args, "complexity-export", context);
}
