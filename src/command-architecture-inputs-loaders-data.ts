import { access } from "node:fs/promises";
import path from "node:path";

import {
  loadBoundaryMapIfRequested,
  loadComplexityExportIfRequested,
  loadContractBaselineIfRequested,
  loadDeliveryExportIfRequested,
  loadDeliveryNormalizationProfileIfRequested,
  loadDeliveryObservationsIfRequested,
  loadDeliveryRawObservationsIfRequested,
  loadPatternRuntimeNormalizationProfileIfRequested,
  loadPatternRuntimeObservationsIfRequested,
  loadPatternRuntimeRawObservationsIfRequested,
  loadRuntimeObservationsIfRequested,
  loadScenarioCatalogIfRequested,
  loadScenarioObservationsIfRequested,
  loadTelemetryExportIfRequested,
  loadTelemetryNormalizationProfileIfRequested,
  loadTelemetryObservationsIfRequested,
  loadTelemetryRawObservationsIfRequested,
  loadTopologyModelIfRequested,
} from "./command-helpers.js";
import { getDocsRoot } from "./command-path-helpers.js";
import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeNormalizationProfile,
  ArchitecturePatternRuntimeObservationSet,
  ArchitecturePatternRuntimeRawObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  ArchitectureTopologyModel,
  CommandContext,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet,
} from "./core/contracts.js";

export interface LoadedArchitectureInputData {
  scenarioCatalog?: ArchitectureScenarioCatalog | undefined;
  scenarioObservations?: ScenarioObservationSet | undefined;
  topologyModel?: ArchitectureTopologyModel | undefined;
  boundaryMap?: ArchitectureBoundaryMap | undefined;
  contractBaseline?: ArchitectureContractBaseline | undefined;
  runtimeObservations?: TopologyRuntimeObservationSet | undefined;
  deliveryObservations?: ArchitectureDeliveryObservationSet | undefined;
  deliveryRawObservations?: ArchitectureDeliveryRawObservationSet | undefined;
  deliveryExport?: ArchitectureDeliveryExportBundle | undefined;
  deliveryNormalizationProfile?: ArchitectureDeliveryNormalizationProfile | undefined;
  telemetryObservations?: ArchitectureTelemetryObservationSet | undefined;
  telemetryRawObservations?: ArchitectureTelemetryRawObservationSet | undefined;
  telemetryExport?: ArchitectureTelemetryExportBundle | undefined;
  telemetryNormalizationProfile?: ArchitectureTelemetryNormalizationProfile | undefined;
  patternRuntimeObservations?: ArchitecturePatternRuntimeObservationSet | undefined;
  patternRuntimeRawObservations?: ArchitecturePatternRuntimeRawObservationSet | undefined;
  patternRuntimeNormalizationProfile?: ArchitecturePatternRuntimeNormalizationProfile | undefined;
  complexityExport?: ArchitectureComplexityExportBundle | undefined;
}

const STANDARD_ARCHITECTURE_DOC_INPUTS: Record<string, string[]> = {
  "scenario-catalog": ["architecture/context-probe/architecture-scenarios.yaml", "architecture/scenario-catalog.yaml"],
  "scenario-observations": [
    "architecture/context-probe/architecture-scenario-observations.yaml",
    "architecture/context-probe/architecture-scenario-benchmark-summary.json",
    "architecture/scenario-observations.yaml",
  ],
  "topology-model": ["architecture/context-probe/architecture-topology.yaml", "architecture/topology-model.yaml"],
  "boundary-map": ["architecture/context-probe/architecture-boundary-map.yaml", "architecture/boundary-map.yaml"],
  "contract-baseline": ["architecture/context-probe/architecture-contract-baseline.yaml"],
  "runtime-observations": [
    "architecture/context-probe/architecture-runtime-observations.yaml",
    "architecture/runtime-observations.yaml",
  ],
  "delivery-observations": [
    "architecture/context-probe/architecture-delivery-observations.yaml",
    "architecture/delivery-observations.yaml",
  ],
  "telemetry-observations": [
    "architecture/context-probe/architecture-telemetry-observations.yaml",
    "architecture/telemetry-observations.yaml",
  ],
  "pattern-runtime-observations": [
    "architecture/context-probe/architecture-pattern-runtime-observations.yaml",
    "architecture/pattern-runtime-observations.yaml",
  ],
  "complexity-export": ["architecture/context-probe/architecture-complexity-export.yaml"],
};

async function findFirstExistingPath(baseDirectory: string, candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    const resolved = path.resolve(baseDirectory, candidate);
    try {
      await access(resolved);
      return resolved;
    } catch {
      // Continue until a matching standard path exists.
    }
  }
  return undefined;
}

async function discoverArchitectureInputArgs(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<Record<string, string | boolean>> {
  if (typeof args["docs-root"] !== "string") {
    return args;
  }

  const docsRoot = getDocsRoot(args, context);
  const resolvedArgs: Record<string, string | boolean> = { ...args };

  await Promise.all(
    Object.entries(STANDARD_ARCHITECTURE_DOC_INPUTS).map(async ([argKey, candidates]) => {
      if (typeof resolvedArgs[argKey] === "string") {
        return;
      }
      const discovered = await findFirstExistingPath(docsRoot, candidates);
      if (discovered) {
        resolvedArgs[argKey] = discovered;
      }
    }),
  );

  return resolvedArgs;
}

export async function loadArchitectureInputData(
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<LoadedArchitectureInputData> {
  const resolvedArgs = await discoverArchitectureInputArgs(args, context);
  const [
    scenarioCatalog,
    scenarioObservations,
    topologyModel,
    boundaryMap,
    contractBaseline,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfileResult,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfileResult,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfileResult,
    complexityExport,
  ] = await Promise.all([
    loadScenarioCatalogIfRequested(resolvedArgs, context),
    loadScenarioObservationsIfRequested(resolvedArgs, context),
    loadTopologyModelIfRequested(resolvedArgs, context),
    loadBoundaryMapIfRequested(resolvedArgs, context),
    loadContractBaselineIfRequested(resolvedArgs, context),
    loadRuntimeObservationsIfRequested(resolvedArgs, context),
    loadDeliveryObservationsIfRequested(resolvedArgs, context),
    loadDeliveryRawObservationsIfRequested(resolvedArgs, context),
    loadDeliveryExportIfRequested(resolvedArgs, context),
    loadDeliveryNormalizationProfileIfRequested(resolvedArgs, context),
    loadTelemetryObservationsIfRequested(resolvedArgs, context),
    loadTelemetryRawObservationsIfRequested(resolvedArgs, context),
    loadTelemetryExportIfRequested(resolvedArgs, context),
    loadTelemetryNormalizationProfileIfRequested(resolvedArgs, context),
    loadPatternRuntimeObservationsIfRequested(resolvedArgs, context),
    loadPatternRuntimeRawObservationsIfRequested(resolvedArgs, context),
    loadPatternRuntimeNormalizationProfileIfRequested(resolvedArgs, context),
    loadComplexityExportIfRequested(resolvedArgs, context),
  ]);

  return {
    scenarioCatalog,
    scenarioObservations,
    topologyModel,
    boundaryMap,
    contractBaseline,
    runtimeObservations,
    deliveryObservations,
    deliveryRawObservations,
    deliveryExport,
    deliveryNormalizationProfile: deliveryNormalizationProfileResult?.config,
    telemetryObservations,
    telemetryRawObservations,
    telemetryExport,
    telemetryNormalizationProfile: telemetryNormalizationProfileResult?.config,
    patternRuntimeObservations,
    patternRuntimeRawObservations,
    patternRuntimeNormalizationProfile: patternRuntimeNormalizationProfileResult?.config,
    complexityExport,
  };
}
