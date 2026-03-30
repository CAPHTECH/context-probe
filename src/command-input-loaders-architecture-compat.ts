import type {
  ArchitectureBoundaryMap,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryObservationSet,
  ArchitectureTopologyModel,
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

export function normalizeArchitectureScenarioCatalog(input: unknown): ArchitectureScenarioCatalog {
  if (!isRecord(input)) {
    return { version: "1.0", scenarios: [] };
  }
  if (Array.isArray(input.scenarios) && input.scenarios.every((entry) => isRecord(entry) && "scenarioId" in entry)) {
    return input as unknown as ArchitectureScenarioCatalog;
  }

  const scenarios = Array.isArray(input.scenarios)
    ? input.scenarios.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }
        const scenarioId = asString(entry.scenarioId) ?? asString(entry.id);
        if (!scenarioId) {
          return [];
        }
        const expectations = Array.isArray(entry.quality_expectations)
          ? entry.quality_expectations.filter(isRecord)
          : [];
        const firstExpectation = expectations[0];
        const normalized = {
          scenarioId,
          direction: "higher_is_better" as const,
          priority: normalizeScenarioPriority(entry.priority),
          target: 1,
          worstAcceptable: 0,
        };
        const name = asString(entry.name);
        const qualityAttribute = asString(firstExpectation?.attribute);
        const response = asString(firstExpectation?.expectation);
        const stimulus = isRecord(entry.entry_surface) ? asString(entry.entry_surface.trigger) : undefined;
        const environment = isRecord(entry.entry_surface) ? asString(entry.entry_surface.user_surface) : undefined;
        return [
          {
            ...normalized,
            ...(name ? { name } : {}),
            ...(qualityAttribute ? { qualityAttribute } : {}),
            ...(stimulus ? { stimulus } : {}),
            ...(environment ? { environment } : {}),
            ...(response ? { response } : {}),
          },
        ];
      })
    : [];

  return {
    version: toVersion(input),
    scenarios,
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
    return input as unknown as ArchitectureTopologyModel;
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
    return input as unknown as ArchitectureBoundaryMap;
  }

  const contexts = Array.isArray(input.contexts) ? input.contexts.filter(isRecord) : [];
  return {
    version: toVersion(input),
    boundaries: contexts.flatMap((context) => {
      const name = asString(context.name);
      if (!name) {
        return [];
      }
      return [
        {
          name,
          pathGlobs: asStringArray(context.pathGlobs),
        },
      ];
    }),
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
    return input as unknown as ArchitectureTelemetryObservationSet;
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
