import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureDeliveryObservationSet,
} from "../core/contracts.js";
import { matchGlobs, toPosixPath } from "../core/io.js";

export interface ArchitectureEvolutionFinding {
  kind:
    | "cross_boundary_cochange"
    | "high_propagation_cost"
    | "high_clustering_cost"
    | "missing_delivery_observation"
    | "weak_delivery_score";
  confidence: number;
  note: string;
  commitHash?: string;
  component?: keyof ArchitectureDeliveryObservationSet["scores"];
}

export interface ArchitectureEvolutionLocalityScore {
  CrossBoundaryCoChange: number;
  WeightedPropagationCost: number;
  WeightedClusteringCost: number;
  confidence: number;
  unknowns: string[];
  findings: ArchitectureEvolutionFinding[];
}

export interface ArchitectureEvolutionEfficiencyScore {
  Delivery: number;
  Locality: number;
  confidence: number;
  unknowns: string[];
  findings: ArchitectureEvolutionFinding[];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function uniqueUnknowns(entries: string[]): string[] {
  return Array.from(new Set(entries));
}

export function architectureBoundaries(constraints: ArchitectureConstraints, boundaryMap?: ArchitectureBoundaryMap) {
  if (boundaryMap && boundaryMap.boundaries.length > 0) {
    return boundaryMap.boundaries;
  }
  return constraints.layers.map((layer) => ({
    name: layer.name,
    pathGlobs: layer.globs,
  }));
}

export function classifyBoundary(
  filePath: string,
  boundaries: Array<{ name: string; pathGlobs: string[] }>,
): string | undefined {
  const normalized = toPosixPath(filePath);
  return boundaries.find((boundary) => matchGlobs(normalized, boundary.pathGlobs))?.name;
}

export function pairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
}
