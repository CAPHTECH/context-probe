import type { LayerDefinition } from "./contracts.js";

export interface ScenarioDraftProfile {
  name: string;
  qualityAttribute: string;
  metric: string;
  stimulus: string;
  response: string;
}

export function normalizeNodeId(name: string): string {
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

export function buildScenarioProfile(layer: LayerDefinition): ScenarioDraftProfile {
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

export function inferTopologyNodeKind(
  layer: LayerDefinition,
): "service" | "datastore" | "queue" | "cache" | "gateway" | "worker" | "unknown" {
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
