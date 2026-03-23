import type {
  ArchitectureTopologyModel,
  TopologyRuntimeObservationSet
} from "../core/contracts.js";

export interface TopologyIsolationFinding {
  kind: "shared_dependency" | "weak_failure_isolation" | "weak_runtime_containment";
  nodeId?: string;
  source?: string;
  target?: string;
  confidence: number;
  note: string;
}

export interface TopologyIsolationScore {
  FI: number;
  RC: number;
  SDR: number;
  confidence: number;
  unknowns: string[];
  findings: TopologyIsolationFinding[];
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

export function scoreTopologyIsolation(input: {
  topology?: ArchitectureTopologyModel;
  observations?: TopologyRuntimeObservationSet;
}): TopologyIsolationScore {
  const topology = input.topology;
  const observations = input.observations?.observations ?? [];

  if (!topology || topology.nodes.length === 0) {
    return {
      FI: 0.4,
      RC: 0.4,
      SDR: 0.6,
      confidence: 0.25,
      unknowns: ["No topology model was provided, so TIS is close to unobserved."],
      findings: []
    };
  }

  const findings: TopologyIsolationFinding[] = [];
  const unknowns: string[] = [];
  const nodeById = new Map(topology.nodes.map((node) => [node.nodeId, node]));
  const sharedEdges = topology.edges.filter((edge) => edge.shared || edge.kind === "shared_resource");
  const syncEdges = topology.edges.filter((edge) => edge.kind === "sync_call");

  const crossBoundarySyncEdges = syncEdges.filter((edge) => {
    const sourceBoundary = nodeById.get(edge.source)?.isolationBoundary;
    const targetBoundary = nodeById.get(edge.target)?.isolationBoundary;
    return Boolean(sourceBoundary && targetBoundary && sourceBoundary !== targetBoundary);
  });

  const SDR = topology.edges.length === 0 ? 0 : sharedEdges.length / topology.edges.length;
  if (sharedEdges.length === 0) {
    unknowns.push("No shared resources were observed, so SDR evidence is limited.");
  }
  findings.push(
    ...sharedEdges.map((edge) => ({
      kind: "shared_dependency" as const,
      source: edge.source,
      target: edge.target,
      confidence: 0.86,
      note: `There is a shared dependency between ${edge.source} and ${edge.target}.`
    }))
  );

  const staticFi = clamp01(1 - crossBoundarySyncEdges.length / Math.max(1, syncEdges.length || 1));
  const runtimeFiSignals = observations
    .map((entry) => entry.failureContainmentRatio)
    .filter((value): value is number => value !== undefined);
  const FI =
    runtimeFiSignals.length > 0 ? average(runtimeFiSignals.map((value) => clamp01(value)), staticFi) : staticFi;
  if (runtimeFiSignals.length === 0) {
    unknowns.push("Runtime observations for failure containment are missing, so FI is using a static proxy.");
  }
  findings.push(
    ...crossBoundarySyncEdges.map((edge) => ({
      kind: "weak_failure_isolation" as const,
      source: edge.source,
      target: edge.target,
      confidence: 0.8,
      note: `The synchronous dependency from ${edge.source} to ${edge.target} crosses an isolation boundary.`
    }))
  );

  const boundaryNodeCounts = new Map<string, number>();
  for (const node of topology.nodes) {
    const boundary = node.isolationBoundary;
    if (!boundary) {
      continue;
    }
    boundaryNodeCounts.set(boundary, (boundaryNodeCounts.get(boundary) ?? 0) + 1);
  }
  const maxBoundarySize = boundaryNodeCounts.size === 0 ? topology.nodes.length : Math.max(...boundaryNodeCounts.values());
  const staticRc = clamp01(1 - (maxBoundarySize - 1) / Math.max(1, topology.nodes.length - 1 || 1));
  const runtimeRcSignals = observations
    .map((entry) => entry.runtimeContainment)
    .filter((value): value is number => value !== undefined);
  const RC =
    runtimeRcSignals.length > 0 ? average(runtimeRcSignals.map((value) => clamp01(value)), staticRc) : staticRc;
  if (runtimeRcSignals.length === 0) {
    unknowns.push("Runtime containment observations are missing, so RC is using a static proxy.");
  }
  for (const [boundary, count] of boundaryNodeCounts.entries()) {
    if (count <= Math.ceil(topology.nodes.length / 2)) {
      continue;
    }
    findings.push({
      kind: "weak_runtime_containment",
      nodeId: boundary,
      confidence: 0.72,
      note: `Nodes are concentrated in ${boundary}, so runtime containment may be weak.`
    });
  }

  if (topology.nodes.every((node) => !node.isolationBoundary)) {
    unknowns.push("Very few isolation boundaries are defined, so FI/RC evidence is limited.");
  }

  return {
    FI,
    RC,
    SDR,
    confidence: clamp01(
      average(
        [
          topology.nodes.length > 0 ? 0.82 : 0.25,
          topology.edges.length > 0 ? 0.8 : 0.4,
          observations.length > 0 ? 0.86 : 0.55
        ],
        0.45
      )
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings
  };
}
