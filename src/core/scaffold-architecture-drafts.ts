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

export interface ArchitectureScaffoldDraft<T> {
  value: T;
  yaml: string;
}

export interface ArchitectureScaffoldDrafts {
  scenarioObservationsTemplate: ArchitectureScaffoldDraft<ArchitectureScenarioObservationTemplate>;
  scenarioCatalog: ArchitectureScaffoldDraft<ArchitectureScenarioCatalog>;
  topologyModel: ArchitectureScaffoldDraft<ArchitectureTopologyModel>;
  boundaryMap: ArchitectureScaffoldDraft<ArchitectureBoundaryMap>;
}

interface ScenarioDraftProfile {
  name: string;
  qualityAttribute: string;
  metric: string;
  stimulus: string;
  response: string;
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

function humanizeLayerName(name: string): string {
  const stripped = name.replace(/\d+$/u, "");
  const words = stripped
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(/\s+/u)
    .filter((segment) => segment.length > 0);

  if (words.length === 0) {
    return name;
  }

  const lowercaseWords = new Set(["and", "or", "of", "the", "to", "for", "in", "on", "with"]);
  return words
    .map((word, index) => {
      const normalized = word.toLowerCase();
      if (index > 0 && lowercaseWords.has(normalized)) {
        return normalized;
      }
      if (/^[A-Z0-9]{2,}$/u.test(word)) {
        return word;
      }
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function includesAny(normalizedName: string, markers: string[]): boolean {
  return markers.some((marker) => normalizedName.includes(marker));
}

function buildScenarioProfile(layer: LayerDefinition): ScenarioDraftProfile {
  const normalized = normalizeNodeId(layer.name);
  const displayName = humanizeLayerName(layer.name);
  const stimulus = `A change request primarily affects the ${displayName} layer.`;

  if (includesAny(normalized, ["domain", "core", "kernel", "model", "foundation"])) {
    return {
      name: "Domain cohesion",
      qualityAttribute: "Domain cohesion",
      metric: "cohesion",
      stimulus,
      response: `The change preserves ${displayName} cohesion and avoids unnecessary cross-layer spread.`,
    };
  }
  if (includesAny(normalized, ["contract", "contracts", "schema", "schemas", "dto", "dtos", "api"])) {
    return {
      name: "Contract stability",
      qualityAttribute: "Contract stability",
      metric: "stability",
      stimulus,
      response: `The change preserves ${displayName} contract boundaries and avoids interface churn.`,
    };
  }
  if (includesAny(normalized, ["ingest", "extract", "import", "load", "parser", "parse", "sync", "crawl"])) {
    return {
      name: "Ingestion coverage",
      qualityAttribute: "Ingestion coverage",
      metric: "coverage",
      stimulus,
      response: `The change keeps ${displayName} ingestion work localized and avoids spreading parsing concerns.`,
    };
  }
  if (includesAny(normalized, ["runtime", "infra", "infrastructure", "platform", "persistence"])) {
    return {
      name: "Runtime containment",
      qualityAttribute: "Runtime containment",
      metric: "containment",
      stimulus,
      response: `The change stays contained within ${displayName} and avoids pulling runtime concerns inward.`,
    };
  }
  if (includesAny(normalized, ["workspace", "project", "bootstrap", "config", "env", "setup"])) {
    return {
      name: "Workspace bootstrap readiness",
      qualityAttribute: "Workspace bootstrap readiness",
      metric: "readiness",
      stimulus,
      response: `The change preserves ${displayName} readiness and keeps setup concerns isolated.`,
    };
  }
  if (
    includesAny(normalized, ["evaluation", "quality", "benchmark", "review", "telemetry", "metric", "score", "eval"])
  ) {
    return {
      name: "Evaluation fidelity",
      qualityAttribute: "Evaluation fidelity",
      metric: "fidelity",
      stimulus,
      response: `The change preserves ${displayName} fidelity and keeps measurement logic explicit.`,
    };
  }
  if (includesAny(normalized, ["test", "tests", "verify", "validation"])) {
    return {
      name: "Validation coverage",
      qualityAttribute: "Validation coverage",
      metric: "coverage",
      stimulus,
      response: `The change preserves ${displayName} coverage and keeps validation concerns isolated.`,
    };
  }
  if (includesAny(normalized, ["shared", "common", "util", "utils", "types"])) {
    return {
      name: "Shared surface stability",
      qualityAttribute: "Shared surface stability",
      metric: "stability",
      stimulus,
      response: `The change preserves ${displayName} surface stability and avoids leaking shared abstractions.`,
    };
  }
  if (includesAny(normalized, ["data", "store", "storage", "db", "database", "cache", "queue"])) {
    return {
      name: "Data locality",
      qualityAttribute: "Data locality",
      metric: "locality",
      stimulus,
      response: `The change keeps ${displayName} data work localized and avoids data-path spillover.`,
    };
  }
  if (includesAny(normalized, ["tool", "tools", "tooling", "script", "scripts"])) {
    return {
      name: "Tooling fit",
      qualityAttribute: "Tooling fit",
      metric: "fit",
      stimulus,
      response: `The change keeps ${displayName} tooling aligned with operational needs.`,
    };
  }
  if (includesAny(normalized, ["application", "app", "usecase", "usecases", "service", "services", "orchestration"])) {
    return {
      name: "Application flow locality",
      qualityAttribute: "Application flow locality",
      metric: "locality",
      stimulus,
      response: `The change keeps ${displayName} flow localized and avoids unnecessary cross-layer spread.`,
    };
  }
  if (
    includesAny(normalized, [
      "adapter",
      "adapters",
      "delivery",
      "presentation",
      "interface",
      "interfaces",
      "ui",
      "server",
      "mcp",
    ])
  ) {
    return {
      name: "Boundary adaptation",
      qualityAttribute: "Boundary adaptation",
      metric: "adaptation",
      stimulus,
      response: `The change keeps ${displayName} boundary work explicit and avoids hidden coupling.`,
    };
  }

  return {
    name: `${displayName} locality`,
    qualityAttribute: "Architecture locality",
    metric: "locality",
    stimulus,
    response: `The change remains localized to the ${displayName} layer and avoids unnecessary cross-layer spread.`,
  };
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
): ArchitectureScaffoldDrafts {
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
