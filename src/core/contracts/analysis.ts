export interface FileDependency {
  source: string;
  target: string;
  specifier: string;
  targetKind: "file" | "external" | "missing";
  kind: "import" | "export" | "part";
}

export interface ParsedSourceFile {
  path: string;
  imports: FileDependency[];
  language: "typescript" | "javascript" | "dart";
  generated: boolean;
  libraryRole?: "library" | "part";
}

export interface CodebaseAnalysis {
  files: ParsedSourceFile[];
  dependencies: FileDependency[];
  sourceFiles: string[];
  scorableSourceFiles: string[];
}

export interface ContractUsageReport {
  adherence: number;
  applicableReferences: number;
  compliantReferences: number;
  findings: Array<{
    source: string;
    target: string;
    sourceContext: string;
    targetContext: string;
    targetClassification: "contract" | "internal" | "unclassified";
  }>;
}

export interface BoundaryLeakFinding {
  findingId: string;
  severity: "low" | "medium" | "high";
  sourceContext: string;
  targetContext: string;
  violationType: string;
  sourceSymbol: string;
  targetSymbol: string;
  path: string;
  line?: number;
}

export interface CochangeCommit {
  hash: string;
  subject: string;
  files: string[];
}

export interface CochangeAnalysis {
  commits: CochangeCommit[];
  crossContextCommits: number;
  localCommits: number;
  averageContextsPerCommit: number;
  surpriseCouplingRatio: number;
  crossContextChangeLocality: number;
  featureScatter: number;
  contextsSeen: string[];
}

export interface CochangePairWeight {
  left: string;
  right: string;
  rawCount: number;
  jaccard: number;
}

export interface CochangeStabilityCluster {
  contexts: string[];
  birth: number;
  death: number;
  stability: number;
}

export interface CochangePersistenceAnalysis {
  relevantCommitCount: number;
  contextsSeen: string[];
  pairWeights: CochangePairWeight[];
  stableChangeClusters: CochangeStabilityCluster[];
  naturalSplitLevels: number[];
  noiseRatio: number;
}

export interface CochangePersistenceCandidateScore {
  localityScore: number;
  persistentCouplingPenalty: number;
  strongestPair: CochangePairWeight | null;
  strongestCluster: CochangeStabilityCluster | null;
  clusterPenalty: number;
  pairPenalty: number;
  coherencePenalty: number;
}

export interface EvolutionLocalityModelComparison {
  els: {
    score: number;
    components: {
      CCL: number;
      FS: number;
      SCR: number;
    };
  };
  persistenceCandidate: CochangePersistenceCandidateScore;
  persistenceAnalysis: CochangePersistenceAnalysis;
  delta: number;
}
