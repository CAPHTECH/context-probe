import type {
  ArchitectureBoundaryMap,
  ArchitectureComplexityExportBundle,
  ArchitectureDeliveryExportBundle,
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetryObservationSet,
  ArchitectureTopologyModel,
  ScenarioObservationSet,
} from "./core/contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asMetricValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (isRecord(value)) {
    return asNumber(value.value);
  }
  return undefined;
}

function withNumericField<T extends string>(key: T, value: number | undefined): Partial<Record<T, number>> {
  return value !== undefined ? ({ [key]: value } as Record<T, number>) : {};
}

function toVersion(input: Record<string, unknown>): string {
  return asString(input.version) ?? asString(input.schema_version) ?? "1.0";
}

function normalizeScenarioPriority(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    switch (value) {
      case "core":
        return 1;
      case "high":
        return 0.9;
      case "medium":
        return 0.75;
      case "low":
        return 0.5;
      case "optional":
        return 0.35;
      default:
        return 0.5;
    }
  }
  return 0.5;
}

function asScenarioDirection(
  value: unknown,
): ArchitectureScenarioCatalog["scenarios"][number]["direction"] | undefined {
  return value === "higher_is_better" || value === "lower_is_better" ? value : undefined;
}

const TOPOLOGY_NODE_KINDS = new Set<ArchitectureTopologyModel["nodes"][number]["kind"]>([
  "service",
  "datastore",
  "queue",
  "cache",
  "gateway",
  "worker",
  "unknown",
]);
const TOPOLOGY_EDGE_KINDS = new Set<ArchitectureTopologyModel["edges"][number]["kind"]>([
  "sync_call",
  "async_message",
  "shared_resource",
  "runtime_dependency",
]);
const PATTERN_FAMILIES = new Set<NonNullable<ArchitecturePatternRuntimeObservationSet["patternFamily"]>>([
  "layered",
  "clean",
  "hexagonal",
  "modular-monolith",
  "microservices",
  "cqrs",
  "event-driven",
]);

function asTopologyNodeKind(value: unknown): ArchitectureTopologyModel["nodes"][number]["kind"] | undefined {
  return typeof value === "string" &&
    TOPOLOGY_NODE_KINDS.has(value as ArchitectureTopologyModel["nodes"][number]["kind"])
    ? (value as ArchitectureTopologyModel["nodes"][number]["kind"])
    : undefined;
}

function asTopologyEdgeKind(value: unknown): ArchitectureTopologyModel["edges"][number]["kind"] | undefined {
  return typeof value === "string" &&
    TOPOLOGY_EDGE_KINDS.has(value as ArchitectureTopologyModel["edges"][number]["kind"])
    ? (value as ArchitectureTopologyModel["edges"][number]["kind"])
    : undefined;
}

function asPatternFamily(value: unknown): ArchitecturePatternRuntimeObservationSet["patternFamily"] | undefined {
  return typeof value === "string" &&
    PATTERN_FAMILIES.has(value as NonNullable<ArchitecturePatternRuntimeObservationSet["patternFamily"]>)
    ? (value as ArchitecturePatternRuntimeObservationSet["patternFamily"])
    : undefined;
}

function withOptionalString<T extends string>(key: T, value: string | undefined): Partial<Record<T, string>> {
  return value !== undefined ? ({ [key]: value } as Record<T, string>) : {};
}

function withOptionalBoolean<T extends string>(key: T, value: boolean | undefined): Partial<Record<T, boolean>> {
  return value !== undefined ? ({ [key]: value } as Record<T, boolean>) : {};
}

function withOptionalObject<T extends string, U extends object>(key: T, value: U | undefined): Partial<Record<T, U>> {
  return value !== undefined ? ({ [key]: value } as Record<T, U>) : {};
}

function withOptionalValue<T extends string, U>(key: T, value: U | undefined): Partial<Record<T, U>> {
  return value !== undefined ? ({ [key]: value } as Record<T, U>) : {};
}

function sanitizeScenarioCatalogEntries(input: unknown): ArchitectureScenarioCatalog["scenarios"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const scenarioId = asString(entry.scenarioId) ?? asString(entry.id);
    if (!scenarioId) {
      return [];
    }
    const expectations = Array.isArray(entry.quality_expectations) ? entry.quality_expectations.filter(isRecord) : [];
    const firstExpectation = expectations[0];
    const responseMeasure = isRecord(entry.responseMeasure)
      ? {
          ...withOptionalString("metric", asString(entry.responseMeasure.metric)),
          ...withOptionalString("unit", asString(entry.responseMeasure.unit)),
        }
      : undefined;
    const sanitizedResponseMeasure =
      responseMeasure && Object.keys(responseMeasure).length > 0 ? responseMeasure : undefined;
    return [
      {
        scenarioId,
        direction: asScenarioDirection(entry.direction) ?? "higher_is_better",
        priority: normalizeScenarioPriority(entry.priority),
        target: asNumber(entry.target) ?? 1,
        worstAcceptable: asNumber(entry.worstAcceptable) ?? 0,
        ...withOptionalString("name", asString(entry.name)),
        ...withOptionalString(
          "qualityAttribute",
          asString(entry.qualityAttribute) ?? asString(firstExpectation?.attribute),
        ),
        ...withOptionalString(
          "stimulus",
          asString(entry.stimulus) ??
            (isRecord(entry.entry_surface) ? asString(entry.entry_surface.trigger) : undefined),
        ),
        ...withOptionalString(
          "environment",
          asString(entry.environment) ??
            (isRecord(entry.entry_surface) ? asString(entry.entry_surface.user_surface) : undefined),
        ),
        ...withOptionalString("response", asString(entry.response) ?? asString(firstExpectation?.expectation)),
        ...withOptionalObject("responseMeasure", sanitizedResponseMeasure),
      },
    ];
  });
}

function sanitizeScenarioObservations(input: unknown): ScenarioObservationSet["observations"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const scenarioId = asString(entry.scenarioId) ?? asString(entry.id);
    const observed = asNumber(entry.observed);
    if (!scenarioId || observed === undefined) {
      return [];
    }
    return [
      {
        scenarioId,
        observed,
        ...withOptionalString("source", asString(entry.source)),
        ...withOptionalString("note", asString(entry.note)),
      },
    ];
  });
}

function sanitizeTopologyNodes(input: unknown): ArchitectureTopologyModel["nodes"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const nodeId = asString(entry.nodeId) ?? asString(entry.id);
    if (!nodeId) {
      return [];
    }
    const kindHint = asString(entry.kind) ?? asString(entry.runtime);
    return [
      {
        nodeId,
        kind: asTopologyNodeKind(entry.kind) ?? inferNodeKind(kindHint),
        ...withOptionalString(
          "isolationBoundary",
          asString(entry.isolationBoundary) ?? asString(entry.isolation_boundary),
        ),
      },
    ];
  });
}

function sanitizeTopologyEdges(input: unknown): ArchitectureTopologyModel["edges"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const source = asString(entry.source);
    const target = asString(entry.target);
    const kind = asTopologyEdgeKind(entry.kind);
    if (!source || !target || !kind) {
      return [];
    }
    const shared = typeof entry.shared === "boolean" ? entry.shared : undefined;
    return [
      {
        source,
        target,
        kind,
        ...withOptionalBoolean("shared", shared),
      },
    ];
  });
}

function sanitizeBoundaryDefinitions(input: unknown): ArchitectureBoundaryMap["boundaries"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const name = asString(entry.name);
    if (!name) {
      return [];
    }
    return [
      {
        name,
        pathGlobs: asStringArray(entry.pathGlobs),
      },
    ];
  });
}

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

function sanitizeTelemetryObservationBands(input: unknown): ArchitectureTelemetryObservationSet["bands"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const bandId = asString(entry.bandId);
    const trafficWeight = asNumber(entry.trafficWeight);
    if (!bandId || trafficWeight === undefined) {
      return [];
    }
    return [
      {
        bandId,
        trafficWeight,
        ...withNumericField("LatencyScore", asNumber(entry.LatencyScore)),
        ...withNumericField("ErrorScore", asNumber(entry.ErrorScore)),
        ...withNumericField("SaturationScore", asNumber(entry.SaturationScore)),
      },
    ];
  });
}

function sanitizeTelemetryExportBands(input: unknown): ArchitectureTelemetryExportBundle["bands"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const bandId = asString(entry.bandId);
    const trafficWeight = asNumber(entry.trafficWeight);
    if (!bandId || trafficWeight === undefined) {
      return [];
    }
    return [
      {
        bandId,
        trafficWeight,
        ...withNumericField("latencyP95", asNumber(entry.latencyP95)),
        ...withNumericField("errorRate", asNumber(entry.errorRate)),
        ...withNumericField("saturationRatio", asNumber(entry.saturationRatio)),
        ...withOptionalString("source", asString(entry.source)),
        ...withOptionalString("window", asString(entry.window)),
      },
    ];
  });
}

function sanitizePatternRuntimeBlock<T extends string>(
  input: unknown,
  keys: readonly T[],
): Partial<Record<T, number>> | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const sanitized: Partial<Record<T, number>> = {};
  for (const key of keys) {
    const value = asNumber(input[key]);
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizePatternRuntimeObservations(input: unknown): ArchitecturePatternRuntimeObservationSet | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const metrics = isRecord(input.metrics)
    ? Object.fromEntries(
        Object.entries(input.metrics).filter(
          (entry): entry is [string, number] => typeof entry[0] === "string" && asNumber(entry[1]) !== undefined,
        ),
      )
    : undefined;
  const sanitizedMetrics = metrics && Object.keys(metrics).length > 0 ? metrics : undefined;
  const layeredRuntime = sanitizePatternRuntimeBlock(input.layeredRuntime, [
    "FailureContainmentScore",
    "DependencyIsolationScore",
  ]);
  const serviceBasedRuntime = sanitizePatternRuntimeBlock(input.serviceBasedRuntime, [
    "PartialFailureContainmentScore",
    "RetryAmplificationScore",
    "SyncHopDepthScore",
  ]);
  const cqrsRuntime = sanitizePatternRuntimeBlock(input.cqrsRuntime, [
    "ProjectionFreshnessScore",
    "ReplayDivergenceScore",
    "StaleReadAcceptabilityScore",
  ]);
  const eventDrivenRuntime = sanitizePatternRuntimeBlock(input.eventDrivenRuntime, [
    "DeadLetterHealthScore",
    "ConsumerLagScore",
    "ReplayRecoveryScore",
  ]);

  return {
    version: asString(input.version) ?? "1.0",
    ...withOptionalString("source", asString(input.source)),
    ...withOptionalString("note", asString(input.note)),
    ...withOptionalObject("layeredRuntime", layeredRuntime),
    ...withOptionalObject("serviceBasedRuntime", serviceBasedRuntime),
    ...withOptionalObject("cqrsRuntime", cqrsRuntime),
    ...withOptionalObject("eventDrivenRuntime", eventDrivenRuntime),
    ...withOptionalObject("metrics", sanitizedMetrics),
    ...withOptionalValue("patternFamily", asPatternFamily(input.patternFamily)),
    ...withNumericField("score", asNumber(input.score)),
  };
}

export function normalizeArchitectureScenarioCatalog(input: unknown): ArchitectureScenarioCatalog {
  if (!isRecord(input)) {
    return { version: "1.0", scenarios: [] };
  }
  return {
    version: toVersion(input),
    scenarios: sanitizeScenarioCatalogEntries(input.scenarios),
  };
}

export function normalizeArchitectureScenarioObservations(input: unknown): ScenarioObservationSet {
  if (!isRecord(input)) {
    return { version: "1.0", observations: [] };
  }
  if (Array.isArray(input.observations)) {
    return {
      version: toVersion(input),
      observations: sanitizeScenarioObservations(input.observations),
    };
  }

  const observationsSource =
    (isRecord(input.benchmarkSummary) && Array.isArray(input.benchmarkSummary.observations)
      ? input.benchmarkSummary.observations
      : undefined) ??
    (isRecord(input.incidentReviewSummary) && Array.isArray(input.incidentReviewSummary.observations)
      ? input.incidentReviewSummary.observations
      : undefined);

  return {
    version: toVersion(input),
    observations: sanitizeScenarioObservations(observationsSource),
  };
}

function inferNodeKind(value: string | undefined): ArchitectureTopologyModel["nodes"][number]["kind"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("gateway")) {
    return "gateway";
  }
  if (
    normalized.includes("database") ||
    normalized.includes("datastore") ||
    normalized.includes("storage") ||
    normalized.includes("table") ||
    normalized.includes("bucket")
  ) {
    return "datastore";
  }
  if (normalized.includes("queue")) {
    return "queue";
  }
  if (normalized.includes("worker") || normalized.includes("lambda") || normalized.includes("pipeline")) {
    return "worker";
  }
  if (normalized.includes("service") || normalized.includes("app") || normalized.includes("runtime")) {
    return "service";
  }
  return "unknown";
}

export function normalizeArchitectureTopologyModel(input: unknown): ArchitectureTopologyModel {
  if (!isRecord(input)) {
    return { version: "1.0", nodes: [], edges: [] };
  }
  if (Array.isArray(input.nodes) && Array.isArray(input.edges)) {
    return {
      version: toVersion(input),
      nodes: sanitizeTopologyNodes(input.nodes),
      edges: sanitizeTopologyEdges(input.edges),
    };
  }

  const nodeMap = new Map<string, ArchitectureTopologyModel["nodes"][number]>();
  const ensureNode = (
    nodeId: string | undefined,
    kindHint?: string,
    isolationBoundary?: string,
  ): ArchitectureTopologyModel["nodes"][number] | undefined => {
    if (!nodeId) {
      return undefined;
    }
    const existing = nodeMap.get(nodeId);
    if (existing) {
      if (!existing.isolationBoundary && isolationBoundary) {
        existing.isolationBoundary = isolationBoundary;
      }
      return existing;
    }
    const node = {
      nodeId,
      kind: inferNodeKind(kindHint),
      ...(isolationBoundary ? { isolationBoundary } : {}),
    } satisfies ArchitectureTopologyModel["nodes"][number];
    nodeMap.set(nodeId, node);
    return node;
  };

  const edges: ArchitectureTopologyModel["edges"] = [];

  const deployables = Array.isArray(input.deployables) ? input.deployables.filter(isRecord) : [];
  for (const deployable of deployables) {
    ensureNode(asString(deployable.id), asString(deployable.kind) ?? asString(deployable.runtime));
  }

  const datastores = Array.isArray(input.datastores) ? input.datastores.filter(isRecord) : [];
  for (const datastore of datastores) {
    ensureNode(asString(datastore.id), asString(datastore.kind) ?? "datastore", "data");
  }

  const services = Array.isArray(input.services) ? input.services.filter(isRecord) : [];
  for (const service of services) {
    const serviceId = asString(service.id);
    const deployable = asString(service.deployable);
    ensureNode(serviceId, asString(service.kind) ?? "service", deployable);

    for (const dependency of asStringArray(service.depends_on)) {
      const [scope, rawTarget] = dependency.split(":");
      const target = rawTarget || scope;
      const targetNode =
        ensureNode(
          target,
          scope === "datastore" ? "datastore" : scope === "deployable" ? "runtime" : "service",
          scope === "datastore" ? "data" : undefined,
        ) ?? ensureNode(target);
      if (!serviceId || !targetNode) {
        continue;
      }
      edges.push({
        source: serviceId,
        target: targetNode.nodeId,
        kind:
          scope === "datastore"
            ? "shared_resource"
            : scope === "deployable"
              ? "runtime_dependency"
              : scope === "queue"
                ? "async_message"
                : "sync_call",
        ...(scope === "datastore" ? { shared: true } : {}),
      });
    }
  }

  return {
    version: toVersion(input),
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

export function normalizeArchitectureBoundaryMap(input: unknown): ArchitectureBoundaryMap {
  if (!isRecord(input)) {
    return { version: "1.0", boundaries: [] };
  }
  if (Array.isArray(input.boundaries)) {
    return {
      version: toVersion(input),
      boundaries: sanitizeBoundaryDefinitions(input.boundaries),
    };
  }

  return {
    version: toVersion(input),
    boundaries: sanitizeBoundaryDefinitions(input.contexts),
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

function telemetryReadinessScore(status: string | undefined, gaps: unknown): number {
  const normalized = (status ?? "").toLowerCase();
  let base =
    normalized === "emitting" || normalized === "observed-in-code"
      ? 0.88
      : normalized === "configured"
        ? 0.74
        : normalized === "configured-not-sampled"
          ? 0.66
          : normalized === "documented-only"
            ? 0.45
            : 0.5;
  const gapCount = Array.isArray(gaps) ? gaps.length : 0;
  base -= Math.min(0.2, gapCount * 0.04);
  return Math.max(0, Math.min(1, base));
}

export function normalizeArchitectureTelemetryObservations(input: unknown): ArchitectureTelemetryObservationSet {
  if (!isRecord(input)) {
    return { version: "1.0", bands: [] };
  }
  if (Array.isArray(input.bands)) {
    return {
      version: toVersion(input),
      bands: sanitizeTelemetryObservationBands(input.bands),
    };
  }

  const sources = Array.isArray(input.sources) ? input.sources.filter(isRecord) : [];
  const observations = Array.isArray(input.observations) ? input.observations.filter(isRecord) : [];
  const candidates = [...sources, ...observations];

  if (candidates.length === 0) {
    return {
      version: toVersion(input),
      bands: [],
    };
  }

  const total = candidates.reduce((sum, candidate) => {
    return sum + telemetryReadinessScore(asString(candidate.status), candidate.gaps);
  }, 0);
  const averageScore = total / candidates.length;

  return {
    version: toVersion(input),
    bands: [
      {
        bandId: "inventory",
        trafficWeight: 1,
        LatencyScore: averageScore,
        ErrorScore: averageScore,
        SaturationScore: averageScore,
      },
    ],
  };
}

export function normalizeArchitectureTelemetryExportBundle(input: unknown): ArchitectureTelemetryExportBundle {
  if (!isRecord(input)) {
    return { version: "1.0", bands: [] };
  }
  if (Array.isArray(input.bands)) {
    return {
      version: toVersion(input),
      bands: sanitizeTelemetryExportBands(input.bands),
      ...withOptionalString("sourceSystem", asString(input.sourceSystem)),
      ...withOptionalObject("patternRuntime", sanitizePatternRuntimeObservations(input.patternRuntime)),
      ...withOptionalString("note", asString(input.note)),
    };
  }

  const embeddedExport =
    isRecord(input.contextProbe) && isRecord(input.contextProbe.exportBundle)
      ? input.contextProbe.exportBundle
      : undefined;
  if (isRecord(embeddedExport) && Array.isArray(embeddedExport.bands)) {
    return {
      version: toVersion(embeddedExport),
      bands: sanitizeTelemetryExportBands(embeddedExport.bands),
      ...withOptionalString("sourceSystem", asString(embeddedExport.sourceSystem)),
      ...withOptionalObject("patternRuntime", sanitizePatternRuntimeObservations(embeddedExport.patternRuntime)),
      ...withOptionalString("note", asString(embeddedExport.note)),
    };
  }

  const sourceSystem = asString(input.sourceSystem);
  const note = asString(input.note);

  return {
    version: toVersion(input),
    bands: [],
    ...(sourceSystem ? { sourceSystem } : {}),
    ...(note ? { note } : {}),
  };
}
