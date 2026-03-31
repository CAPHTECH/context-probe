import YAML from "yaml";

import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureScenarioCatalog,
  ArchitectureScenarioObservationTemplate,
  ArchitectureTopologyModel,
  CodebaseAnalysis,
  LayerDefinition,
} from "./contracts.js";
import { matchGlobs } from "./io.js";
import {
  buildScenarioProfile,
  inferTopologyNodeKind,
  normalizeNodeId,
} from "./scaffold-architecture-drafts-profiles.js";

function buildScenarioCatalog(constraints: ArchitectureConstraints): ArchitectureScenarioCatalog {
  return {
    version: constraints.version,
    scenarios: constraints.layers.map((layer, index) => {
      const profile = buildScenarioProfile(layer);
      return {
        scenarioId: `SC-${String(index + 1).padStart(3, "0")}`,
        name: profile.name,
        qualityAttribute: profile.qualityAttribute,
        stimulus: profile.stimulus,
        environment: "Docs-first repository with scaffolded architecture constraints.",
        response: profile.response,
        responseMeasure: {
          metric: profile.metric,
          unit: "ratio",
        },
        direction: "higher_is_better",
        priority: index + 1,
        target: 0.8,
        worstAcceptable: 0.5,
      };
    }),
  };
}

function buildScenarioObservationsTemplate(
  catalog: ArchitectureScenarioCatalog,
): ArchitectureScenarioObservationTemplate {
  return {
    version: catalog.version,
    scenarios: catalog.scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      ...(scenario.name ? { name: scenario.name } : {}),
      ...(scenario.qualityAttribute ? { qualityAttribute: scenario.qualityAttribute } : {}),
      priority: scenario.priority,
      measurementStatus: "needs_measurement",
      note: `Populate an observed value for ${scenario.qualityAttribute ?? scenario.name ?? scenario.scenarioId} from benchmark or incident review before scoring.`,
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
): {
  scenarioObservationsTemplate: { value: ArchitectureScenarioObservationTemplate; yaml: string };
  scenarioCatalog: { value: ArchitectureScenarioCatalog; yaml: string };
  topologyModel: { value: ArchitectureTopologyModel; yaml: string };
  boundaryMap: { value: ArchitectureBoundaryMap; yaml: string };
} {
  const scenarioCatalog = buildScenarioCatalog(constraints);
  const scenarioObservationsTemplate = buildScenarioObservationsTemplate(scenarioCatalog);
  const topologyModel = buildTopologyModel(codebase, constraints);
  const boundaryMap = buildBoundaryMap(constraints);

  return {
    scenarioObservationsTemplate: {
      value: scenarioObservationsTemplate,
      yaml: YAML.stringify(scenarioObservationsTemplate),
    },
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
