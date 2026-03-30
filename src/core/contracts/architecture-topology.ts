export interface ArchitectureTopologyNode {
  nodeId: string;
  kind: "service" | "datastore" | "queue" | "cache" | "gateway" | "worker" | "unknown";
  isolationBoundary?: string;
}

export interface ArchitectureTopologyEdge {
  source: string;
  target: string;
  kind: "sync_call" | "async_message" | "shared_resource" | "runtime_dependency";
  shared?: boolean;
}

export interface ArchitectureTopologyModel {
  version: string;
  nodes: ArchitectureTopologyNode[];
  edges: ArchitectureTopologyEdge[];
}

export interface TopologyRuntimeObservation {
  nodeId?: string;
  failureContainmentRatio?: number;
  runtimeContainment?: number;
  sharedDependencyIncidentRate?: number;
  note?: string;
}

export interface TopologyRuntimeObservationSet {
  version: string;
  observations: TopologyRuntimeObservation[];
}

export interface ArchitectureBoundaryDefinition {
  name: string;
  pathGlobs: string[];
}

export interface ArchitectureBoundaryMap {
  version: string;
  boundaries: ArchitectureBoundaryDefinition[];
}
