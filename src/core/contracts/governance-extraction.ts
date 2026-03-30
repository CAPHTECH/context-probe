import type { Evidence, ExtractionProviderName } from "./common.js";

export interface GlossaryTerm {
  termId: string;
  canonicalTerm: string;
  aliases: string[];
  count: number;
  collision: boolean;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
}

export interface RuleCandidate {
  ruleId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface InvariantCandidate {
  invariantId: string;
  type: string;
  statement: string;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  fragmentIds: string[];
  relatedTerms?: string[];
}

export interface ExtractionProviderResult<T> {
  items: T[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
  provider: ExtractionProviderName;
}

export interface TraceLinkOccurrence {
  kind: "document" | "code";
  path: string;
  fragmentId?: string;
  matchCount: number;
}

export interface TermTraceLink {
  termId: string;
  canonicalTerm: string;
  occurrences: TraceLinkOccurrence[];
  coverage: {
    documentHits: number;
    codeHits: number;
  };
  confidence: number;
}

export interface ModelCodeLink {
  context: string;
  files: string[];
  counts: {
    contract: number;
    internal: number;
    unclassified: number;
  };
  coverage: number;
}
