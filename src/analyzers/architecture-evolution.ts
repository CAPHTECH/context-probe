import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureDeliveryObservationSet,
  CochangeCommit
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueUnknowns(entries: string[]): string[] {
  return Array.from(new Set(entries));
}

function architectureBoundaries(
  constraints: ArchitectureConstraints,
  boundaryMap?: ArchitectureBoundaryMap
) {
  if (boundaryMap && boundaryMap.boundaries.length > 0) {
    return boundaryMap.boundaries;
  }
  return constraints.layers.map((layer) => ({
    name: layer.name,
    pathGlobs: layer.globs
  }));
}

function classifyBoundary(
  filePath: string,
  boundaries: Array<{ name: string; pathGlobs: string[] }>
): string | undefined {
  const normalized = toPosixPath(filePath);
  return boundaries.find((boundary) => matchGlobs(normalized, boundary.pathGlobs))?.name;
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
}

export function scoreArchitectureEvolutionLocality(options: {
  commits: CochangeCommit[];
  constraints: ArchitectureConstraints;
  boundaryMap?: ArchitectureBoundaryMap;
}): ArchitectureEvolutionLocalityScore {
  const boundaries = architectureBoundaries(options.constraints, options.boundaryMap);
  const findings: ArchitectureEvolutionFinding[] = [];
  const unknowns: string[] = [];

  if (boundaries.length < 2) {
    return {
      CrossBoundaryCoChange: 0.5,
      WeightedPropagationCost: 0.5,
      WeightedClusteringCost: 0.5,
      confidence: 0.25,
      unknowns: ["architecture boundary が不足しており AELS は未観測に近い状態です"],
      findings
    };
  }

  if (!options.boundaryMap) {
    unknowns.push("boundary map が指定されていないため AELS は constraints layers を境界 proxy として使っています");
  }

  const relevant = options.commits
    .map((commit) => {
      const touchedBoundaries = new Set(
        commit.files
          .map((filePath) => classifyBoundary(filePath, boundaries))
          .filter((value): value is string => Boolean(value))
      );
      return {
        ...commit,
        touchedBoundaries
      };
    })
    .filter((entry) => entry.touchedBoundaries.size > 0);

  if (relevant.length === 0) {
    return {
      CrossBoundaryCoChange: 0.5,
      WeightedPropagationCost: 0.5,
      WeightedClusteringCost: 0.5,
      confidence: 0.3,
      unknowns: uniqueUnknowns([
        ...unknowns,
        "architecture boundary と対応づく履歴がなく AELS は未観測に近い状態です"
      ]),
      findings
    };
  }

  const totalBoundaries = Math.max(1, boundaries.length);
  const crossBoundaryCommits = relevant.filter((entry) => entry.touchedBoundaries.size > 1);
  const CrossBoundaryCoChange = crossBoundaryCommits.length / relevant.length;
  const propagationCosts = relevant.map((entry) =>
    totalBoundaries <= 1 ? 0 : (entry.touchedBoundaries.size - 1) / Math.max(1, totalBoundaries - 1)
  );
  const WeightedPropagationCost = clamp01(average(propagationCosts, 0));

  const pairCounts = new Map<string, number>();
  const involvedBoundaries = new Set<string>();
  for (const commit of crossBoundaryCommits) {
    const boundaryNames = Array.from(commit.touchedBoundaries).sort();
    for (const boundary of boundaryNames) {
      involvedBoundaries.add(boundary);
    }
    for (let index = 0; index < boundaryNames.length; index += 1) {
      for (let next = index + 1; next < boundaryNames.length; next += 1) {
        const key = pairKey(boundaryNames[index]!, boundaryNames[next]!);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
    findings.push({
      kind: "cross_boundary_cochange",
      commitHash: commit.hash,
      confidence: 0.82,
      note: `commit ${commit.hash.slice(0, 7)} が複数 boundary を同時変更しています: ${boundaryNames.join(", ")}`
    });
  }

  const maxPossiblePairs = Math.max(1, (totalBoundaries * (totalBoundaries - 1)) / 2);
  const pairSpread = pairCounts.size / maxPossiblePairs;
  const pairTouchDensity =
    Array.from(pairCounts.values()).reduce((sum, value) => sum + value, 0) / Math.max(1, relevant.length * maxPossiblePairs);
  const boundarySpread = involvedBoundaries.size / totalBoundaries;
  const WeightedClusteringCost =
    crossBoundaryCommits.length === 0 ? 0 : clamp01(0.75 * pairTouchDensity + 0.15 * pairSpread + 0.10 * boundarySpread);

  if (relevant.length < 3) {
    unknowns.push("architecture locality を評価する履歴がまだ少ないため AELS は暫定値です");
  }
  if (crossBoundaryCommits.length === 0) {
    unknowns.push("cross-boundary co-change が観測されず WPC/WCC の根拠は限定的です");
  }

  if (WeightedPropagationCost > 0.5) {
    findings.push({
      kind: "high_propagation_cost",
      confidence: 0.76,
      note: `WeightedPropagationCost が ${WeightedPropagationCost.toFixed(3)} と高く、変更伝播が広がりやすい状態です`
    });
  }
  if (WeightedClusteringCost > 0.5) {
    findings.push({
      kind: "high_clustering_cost",
      confidence: 0.74,
      note: `WeightedClusteringCost が ${WeightedClusteringCost.toFixed(3)} と高く、boundary 間の change coupling が広く観測されています`
    });
  }

  return {
    CrossBoundaryCoChange,
    WeightedPropagationCost,
    WeightedClusteringCost,
    confidence: clamp01(
      average(
        [
          options.boundaryMap ? 0.86 : 0.68,
          relevant.length >= 3 ? 0.84 : relevant.length > 0 ? 0.58 : 0.3,
          crossBoundaryCommits.length > 0 ? 0.82 : 0.62
        ],
        0.45
      )
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}

export function scoreArchitectureEvolutionEfficiency(options: {
  deliveryObservations?: ArchitectureDeliveryObservationSet;
  locality: number;
  localityUnknowns?: string[];
  localityConfidence: number;
}): ArchitectureEvolutionEfficiencyScore {
  const findings: ArchitectureEvolutionFinding[] = [];
  const unknowns: string[] = [...(options.localityUnknowns ?? [])];
  const scores = options.deliveryObservations?.scores;
  const weightedComponents = [
    {
      component: "LeadTimeScore" as const,
      weight: 0.25,
      value: scores?.LeadTimeScore,
      note: "lead time score を delivery efficiency に反映しています"
    },
    {
      component: "DeployFreqScore" as const,
      weight: 0.2,
      value: scores?.DeployFreqScore,
      note: "deployment frequency score を delivery efficiency に反映しています"
    },
    {
      component: "RecoveryScore" as const,
      weight: 0.2,
      value: scores?.RecoveryScore,
      note: "recovery score を delivery efficiency に反映しています"
    },
    {
      component: "ChangeFailScore" as const,
      weight: 0.2,
      value: scores?.ChangeFailScore,
      invert: true,
      note: "change fail score を反転して delivery efficiency に反映しています"
    },
    {
      component: "ReworkScore" as const,
      weight: 0.15,
      value: scores?.ReworkScore,
      invert: true,
      note: "deployment rework score を反転して delivery efficiency に反映しています"
    }
  ];

  let observedWeight = 0;
  let weightedSum = 0;
  for (const entry of weightedComponents) {
    if (entry.value === undefined) {
      unknowns.push(`${entry.component} が不足しており Delivery は部分的な近似です`);
      findings.push({
        kind: "missing_delivery_observation",
        component: entry.component,
        confidence: 0.45,
        note: `${entry.component} が指定されていません`
      });
      continue;
    }
    const normalized = clamp01(entry.invert ? 1 - entry.value : entry.value);
    observedWeight += entry.weight;
    weightedSum += entry.weight * normalized;
    if (normalized < 0.5) {
      findings.push({
        kind: "weak_delivery_score",
        component: entry.component,
        confidence: 0.76,
        note: `${entry.note} (normalized=${normalized.toFixed(3)})`
      });
    }
  }

  const Delivery = observedWeight > 0 ? weightedSum / observedWeight : 0.5;
  if (!scores) {
    unknowns.push("delivery observations が指定されていないため Delivery は中立値 0.5 を使っています");
  }

  return {
    Delivery,
    Locality: options.locality,
    confidence: clamp01(
      average(
        [
          observedWeight > 0 ? 0.82 * observedWeight + 0.35 * (1 - observedWeight) : 0.3,
          options.localityConfidence
        ],
        0.4
      )
    ),
    unknowns: uniqueUnknowns(unknowns),
    findings
  };
}
