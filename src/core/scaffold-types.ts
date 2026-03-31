import type {
  ArchitectureLayerCandidate,
  CodebaseAnalysis,
  DomainContextCandidate,
  Evidence,
  ExtractionBackend,
  ExtractionProviderName,
  ReviewResolutionLog,
} from "./contracts.js";

export interface ExtractionOptions {
  root: string;
  cwd: string;
  extractor?: ExtractionBackend;
  provider?: ExtractionProviderName;
  providerCommand?: string;
  promptProfile?: string;
  fallback?: "heuristic" | "none";
  reviewLog?: ReviewResolutionLog;
  applyReviewLog?: boolean;
}

export interface SourceGroup {
  key: string;
  basePath: string;
  sourceRoot?: string;
  segment?: string;
  heuristicSplit?: boolean;
  origins?: string[];
  pathGlobs: string[];
  files: string[];
}

export interface ScaffoldComputation<T> {
  result: T;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  diagnostics: string[];
}

export type { ArchitectureLayerCandidate, CodebaseAnalysis, DomainContextCandidate };
