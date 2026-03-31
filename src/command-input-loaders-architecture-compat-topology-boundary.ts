import {
  asString,
  asStringArray,
  asTopologyEdgeKind,
  asTopologyNodeKind,
  isRecord,
  toVersion,
  withOptionalBoolean,
  withOptionalString,
} from "./command-input-loaders-architecture-compat-shared.js";
import type { ArchitectureBoundaryMap, ArchitectureTopologyModel } from "./core/contracts.js";

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
