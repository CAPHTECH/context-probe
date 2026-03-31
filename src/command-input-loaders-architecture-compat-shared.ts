import type {
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureScenarioCatalog,
  ArchitectureTopologyModel,
} from "./core/contracts.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asMetricValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (isRecord(value)) {
    return asNumber(value.value);
  }
  return undefined;
}

export function withNumericField<T extends string>(key: T, value: number | undefined): Partial<Record<T, number>> {
  return value !== undefined ? ({ [key]: value } as Record<T, number>) : {};
}

export function toVersion(input: Record<string, unknown>): string {
  return asString(input.version) ?? asString(input.schema_version) ?? "1.0";
}

export function normalizeScenarioPriority(value: unknown): number {
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

export function asScenarioDirection(
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

export function asTopologyNodeKind(value: unknown): ArchitectureTopologyModel["nodes"][number]["kind"] | undefined {
  return typeof value === "string" &&
    TOPOLOGY_NODE_KINDS.has(value as ArchitectureTopologyModel["nodes"][number]["kind"])
    ? (value as ArchitectureTopologyModel["nodes"][number]["kind"])
    : undefined;
}

export function asTopologyEdgeKind(value: unknown): ArchitectureTopologyModel["edges"][number]["kind"] | undefined {
  return typeof value === "string" &&
    TOPOLOGY_EDGE_KINDS.has(value as ArchitectureTopologyModel["edges"][number]["kind"])
    ? (value as ArchitectureTopologyModel["edges"][number]["kind"])
    : undefined;
}

export function asPatternFamily(value: unknown): ArchitecturePatternRuntimeObservationSet["patternFamily"] | undefined {
  return typeof value === "string" &&
    PATTERN_FAMILIES.has(value as NonNullable<ArchitecturePatternRuntimeObservationSet["patternFamily"]>)
    ? (value as ArchitecturePatternRuntimeObservationSet["patternFamily"])
    : undefined;
}

export function withOptionalString<T extends string>(key: T, value: string | undefined): Partial<Record<T, string>> {
  return value !== undefined ? ({ [key]: value } as Record<T, string>) : {};
}

export function withOptionalBoolean<T extends string>(key: T, value: boolean | undefined): Partial<Record<T, boolean>> {
  return value !== undefined ? ({ [key]: value } as Record<T, boolean>) : {};
}

export function withOptionalObject<T extends string, U extends object>(
  key: T,
  value: U | undefined,
): Partial<Record<T, U>> {
  return value !== undefined ? ({ [key]: value } as Record<T, U>) : {};
}

export function withOptionalValue<T extends string, U>(key: T, value: U | undefined): Partial<Record<T, U>> {
  return value !== undefined ? ({ [key]: value } as Record<T, U>) : {};
}
