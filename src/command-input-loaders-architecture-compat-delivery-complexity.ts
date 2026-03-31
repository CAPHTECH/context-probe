import {
  asMetricValue,
  asNumber,
  asString,
  isRecord,
  toVersion,
  withNumericField,
  withOptionalString,
} from "./command-input-loaders-architecture-compat-shared.js";
import type { ArchitectureComplexityExportBundle, ArchitectureDeliveryExportBundle } from "./core/contracts.js";

function sanitizeDeliveryMeasurements(input: unknown): ArchitectureDeliveryExportBundle["measurements"] {
  if (!isRecord(input)) {
    return {};
  }
  return {
    ...withNumericField("leadTime", asNumber(input.leadTime)),
    ...withNumericField("deployFrequency", asNumber(input.deployFrequency)),
    ...withNumericField("recoveryTime", asNumber(input.recoveryTime)),
    ...withNumericField("changeFailRate", asNumber(input.changeFailRate)),
    ...withNumericField("reworkRate", asNumber(input.reworkRate)),
  };
}

function sanitizeComplexityMetrics(input: unknown): ArchitectureComplexityExportBundle["metrics"] {
  if (!isRecord(input)) {
    return {};
  }
  return {
    ...withNumericField("teamCount", asNumber(input.teamCount)),
    ...withNumericField("deployableCount", asNumber(input.deployableCount)),
    ...withNumericField("pipelineCount", asNumber(input.pipelineCount)),
    ...withNumericField("contractOrSchemaCount", asNumber(input.contractOrSchemaCount)),
    ...withNumericField("serviceCount", asNumber(input.serviceCount)),
    ...withNumericField("serviceGroupCount", asNumber(input.serviceGroupCount)),
    ...withNumericField("datastoreCount", asNumber(input.datastoreCount)),
    ...withNumericField("onCallSurface", asNumber(input.onCallSurface)),
    ...withNumericField("syncDepthP95", asNumber(input.syncDepthP95)),
    ...withNumericField("runCostPerBusinessTransaction", asNumber(input.runCostPerBusinessTransaction)),
  };
}

export function normalizeArchitectureDeliveryExportBundle(input: unknown): ArchitectureDeliveryExportBundle {
  if (!isRecord(input)) {
    return { version: "1.0", measurements: {} };
  }
  if (isRecord(input.measurements)) {
    return {
      version: toVersion(input),
      ...withOptionalString("sourceSystem", asString(input.sourceSystem)),
      measurements: sanitizeDeliveryMeasurements(input.measurements),
      ...withOptionalString("note", asString(input.note)),
    };
  }

  const embeddedExport =
    isRecord(input.contextProbe) && isRecord(input.contextProbe.exportBundle)
      ? input.contextProbe.exportBundle
      : undefined;
  if (isRecord(embeddedExport) && isRecord(embeddedExport.measurements)) {
    return {
      version: toVersion(embeddedExport),
      ...withOptionalString("sourceSystem", asString(embeddedExport.sourceSystem)),
      measurements: sanitizeDeliveryMeasurements(embeddedExport.measurements),
      ...withOptionalString("note", asString(embeddedExport.note)),
    };
  }

  const dora = isRecord(input.dora) ? input.dora : undefined;
  const metrics = isRecord(input.metrics) ? input.metrics : undefined;
  const sourceSystem = asString(input.sourceSystem);
  const note = asString(input.note);
  const leadTime = asMetricValue(dora?.leadTime) ?? asMetricValue(metrics?.LeadTime);
  const deployFrequency = asMetricValue(dora?.deployFrequency) ?? asMetricValue(metrics?.DeployFrequency);
  const recoveryTime = asMetricValue(dora?.recoveryTime) ?? asMetricValue(metrics?.RecoveryTime);
  const changeFailRate = asMetricValue(dora?.changeFailRate) ?? asMetricValue(metrics?.ChangeFailRate);
  const reworkRate = asMetricValue(dora?.reworkRate) ?? asMetricValue(metrics?.ReworkRate);

  return {
    version: toVersion(input),
    ...(sourceSystem ? { sourceSystem } : {}),
    measurements: {
      ...withNumericField("leadTime", leadTime),
      ...withNumericField("deployFrequency", deployFrequency),
      ...withNumericField("recoveryTime", recoveryTime),
      ...withNumericField("changeFailRate", changeFailRate),
      ...withNumericField("reworkRate", reworkRate),
    },
    ...(note ? { note } : {}),
  };
}

export function normalizeArchitectureComplexityExportBundle(input: unknown): ArchitectureComplexityExportBundle {
  if (!isRecord(input)) {
    return { version: "1.0", metrics: {} };
  }
  if (isRecord(input.metrics)) {
    return {
      version: toVersion(input),
      ...withOptionalString("sourceSystem", asString(input.sourceSystem)),
      metrics: sanitizeComplexityMetrics(input.metrics),
      ...withOptionalString("note", asString(input.note)),
    };
  }

  const embeddedExport =
    isRecord(input.contextProbe) && isRecord(input.contextProbe.exportBundle)
      ? input.contextProbe.exportBundle
      : undefined;
  if (isRecord(embeddedExport) && isRecord(embeddedExport.metrics)) {
    return {
      version: toVersion(embeddedExport),
      ...withOptionalString("sourceSystem", asString(embeddedExport.sourceSystem)),
      metrics: sanitizeComplexityMetrics(embeddedExport.metrics),
      ...withOptionalString("note", asString(embeddedExport.note)),
    };
  }

  const team = isRecord(input.team) ? input.team : undefined;
  const platform = isRecord(input.platform) ? input.platform : undefined;
  const architecture = isRecord(input.architecture) ? input.architecture : undefined;
  const finance = isRecord(input.finance) ? input.finance : undefined;
  const sourceSystem = asString(input.sourceSystem);
  const note = asString(input.note);
  const teamCount = asNumber(team?.count);
  const deployableCount = asNumber(platform?.deployableCount);
  const pipelineCount = asNumber(platform?.pipelinesPerDeployable);
  const contractOrSchemaCount = asNumber(architecture?.contractOrSchemaCount);
  const serviceCount = asNumber(architecture?.serviceCount);
  const serviceGroupCount = asNumber(architecture?.serviceGroupCount);
  const datastoreCount = asNumber(platform?.datastoreCount);
  const onCallSurface = asNumber(platform?.onCallSurface);
  const syncDepthP95 = asNumber(platform?.syncDepthP95);
  const runCostPerBusinessTransaction = asNumber(finance?.runCostPerBusinessTransaction);

  return {
    version: toVersion(input),
    ...(sourceSystem ? { sourceSystem } : {}),
    metrics: {
      ...withNumericField("teamCount", teamCount),
      ...withNumericField("deployableCount", deployableCount),
      ...withNumericField("pipelineCount", pipelineCount),
      ...withNumericField("contractOrSchemaCount", contractOrSchemaCount),
      ...withNumericField("serviceCount", serviceCount),
      ...withNumericField("serviceGroupCount", serviceGroupCount),
      ...withNumericField("datastoreCount", datastoreCount),
      ...withNumericField("onCallSurface", onCallSurface),
      ...withNumericField("syncDepthP95", syncDepthP95),
      ...withNumericField("runCostPerBusinessTransaction", runCostPerBusinessTransaction),
    },
    ...(note ? { note } : {}),
  };
}
