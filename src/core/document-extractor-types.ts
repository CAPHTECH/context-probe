import type {
  ExtractionBackend,
  ExtractionProviderName,
  Fragment,
  GlossaryTerm,
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

export interface HeuristicTermCandidate {
  canonicalTerm: string;
  aliases: string[];
  count: number;
  evidence: GlossaryTerm["evidence"];
  fragmentIds: string[];
}

export interface HeuristicStatementCandidate {
  statement: string;
  fragment: Fragment;
  confidence: number;
  unknowns: string[];
  sourceKind: "sentence" | "bullet";
}

export interface StatementSegment {
  text: string;
  sourceKind: "sentence" | "bullet";
}
