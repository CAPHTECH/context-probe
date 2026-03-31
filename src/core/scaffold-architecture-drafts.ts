import YAML from "yaml";
import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureScenarioCatalog,
  ArchitectureTopologyModel,
  CodebaseAnalysis,
  LayerDefinition,
} from "./contracts.js";
import { matchGlobs } from "./io.js";

export interface ArchitectureScaffoldDraft<T> {
  value: T;
  yaml: string;
}

export interface ArchitectureScaffoldDrafts {
  scenarioCatalog: ArchitectureScaffoldDraft<ArchitectureScenarioCatalog>;
  topologyModel: ArchitectureScaffoldDraft<ArchitectureTopologyModel>;
  boundaryMap: ArchitectureScaffoldDraft<ArchitectureBoundaryMap>;
}

function normalizeNodeId(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function inferTopologyNodeKind(layer: LayerDefinition): ArchitectureTopologyModel["nodes"][number]["kind"] {
  const normalized = normalizeNodeId(layer.name);
  if (/(data|store|storage|db|database|persistence|cache|queue)/u.test(normalized)) {
    return "datastore";
  }
  if (/(worker|job|script|test|eval|quality)/u.test(normalized)) {
    return "worker";
  }
  if (/(api|ui|presentation|delivery|adapter|adapters|extract|extractors|server|mcp)/u.test(normalized)) {
    return "gateway";
  }
  if (
    /(contract|domain|core|kernel|foundation|model|usecase|usecases|service|services|application|runtime|project|workspace|bootstrap|infra|infrastructure|platform)/u.test(
      normalized,
    )
  ) {
    return "service";
  }
  return "unknown";
}

function buildScenarioCatalog(constraints: ArchitectureConstraints): ArchitectureScenarioCatalog {
  return {
    version: constraints.version,
    scenarios: constraints.layers.map((layer, index) => ({
      scenarioId: `SC-${String(index + 1).padStart(3, "0")}`,
      name: `${layer.name} locality`,
      qualityAttribute: "Architecture locality",
      stimulus: `A change request primarily affects the ${layer.name} layer.`,
      environment: "Docs-first repository with scaffolded architecture constraints.",
      response: `The change remains localized to the ${layer.name} layer and avoids unnecessary cross-layer spread.`,
      responseMeasure: {
        metric: "locality",
        unit: "ratio",
      },
      direction: "higher_is_better",
      priority: index + 1,
      target: 0.8,
      worstAcceptable: 0.5,
    })),
  };
}

function classifyLayer(path: string, constraints: ArchitectureConstraints): LayerDefinition | undefined {
  return constraints.layers.find((layer) => matchGlobs(path, layer.globs));
}

function buildTopologyModel(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints,
): ArchitectureTopologyModel {
  const nodes = constraints.layers.map((layer) => ({
    nodeId: normalizeNodeId(layer.name),
    kind: inferTopologyNodeKind(layer),
    isolationBoundary: layer.name,
  }));
  const edges = new Map<string, ArchitectureTopologyModel["edges"][number]>();

  for (const dependency of codebase.dependencies) {
    if (dependency.targetKind !== "file") {
      continue;
    }
    const sourceLayer = classifyLayer(dependency.source, constraints);
    const targetLayer = classifyLayer(dependency.target, constraints);
    if (!sourceLayer || !targetLayer || sourceLayer.name === targetLayer.name) {
      continue;
    }
    const edgeKey = `${sourceLayer.name} -> ${targetLayer.name}`;
    if (!edges.has(edgeKey)) {
      edges.set(edgeKey, {
        source: normalizeNodeId(sourceLayer.name),
        target: normalizeNodeId(targetLayer.name),
        kind: "sync_call",
      });
    }
  }

  const fallbackEdges =
    edges.size > 0
      ? Array.from(edges.values())
      : nodes.slice(1).map((node, index) => ({
          source: nodes[index]?.nodeId ?? node.nodeId,
          target: node.nodeId,
          kind: "sync_call" as const,
        }));

  return {
    version: constraints.version,
    nodes,
    edges: fallbackEdges,
  };
}

function buildBoundaryMap(constraints: ArchitectureConstraints): ArchitectureBoundaryMap {
  return {
    version: constraints.version,
    boundaries: constraints.layers.map((layer) => ({
      name: layer.name,
      pathGlobs: layer.globs,
    })),
  };
}

export function buildArchitectureScaffoldDrafts(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints,
): ArchitectureScaffoldDrafts {
  const scenarioCatalog = buildScenarioCatalog(constraints);
  const topologyModel = buildTopologyModel(codebase, constraints);
  const boundaryMap = buildBoundaryMap(constraints);

  return {
    scenarioCatalog: {
      value: scenarioCatalog,
      yaml: YAML.stringify(scenarioCatalog),
    },
    topologyModel: {
      value: topologyModel,
      yaml: YAML.stringify(topologyModel),
    },
    boundaryMap: {
      value: boundaryMap,
      yaml: YAML.stringify(boundaryMap),
    },
  };
}
