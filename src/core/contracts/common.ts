export const OUTPUT_VERSION = "1.0";

export type CommandStatus = "ok" | "warning" | "error";

export interface ProvenanceRef {
  artifactId?: string;
  path?: string;
  line?: number;
  fragmentId?: string;
  revision?: string;
  note?: string;
}

export interface Evidence {
  evidenceId: string;
  type: string;
  statement: string;
  confidence: number;
  linkedEntities?: string[];
  source: Record<string, unknown>;
}

export interface ProgressUpdate {
  phase: string;
  message: string;
  elapsedMs?: number;
}

export type DecisionRiskLevel = "low" | "medium" | "high";

export interface MeasurementQualitySummary {
  unknownsCount: number;
  metricUnknownCounts: Record<string, number>;
  proxyMetrics: string[];
  proxyRate: number;
  approximationNotes: string[];
  decisionRisk: DecisionRiskLevel;
}

export interface RuntimeStageSummary {
  inputLoadMs?: number;
  extractionMs?: number;
  historyMs?: number;
  analysisMs?: number;
  renderMs?: number;
  reviewMs?: number;
  gateMs?: number;
}

export interface RuntimeSummary {
  totalMs: number;
  stages: RuntimeStageSummary;
}

export interface CommandResponseMeta {
  measurementQuality?: MeasurementQualitySummary;
  runtime?: RuntimeSummary;
}

export type ExtractionKind = "glossary" | "rules" | "invariants";
export type ExtractionBackend = "heuristic" | "cli";
export type ExtractionProviderName = "codex" | "claude";

export interface ExtractionMetadata {
  extractor: ExtractionBackend;
  provider?: ExtractionProviderName;
  promptProfile: string;
  fallback: "heuristic" | "none";
}

export interface CommandResponse<T = unknown> {
  status: CommandStatus;
  result: T;
  evidence: Evidence[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
  progress: ProgressUpdate[];
  provenance: ProvenanceRef[];
  meta?: CommandResponseMeta;
  version: string;
}

export interface Artifact {
  artifactId: string;
  type: "document" | "source_code" | "history" | "config" | "unknown";
  path: string;
  size: number;
  hash: string;
  collectedAt: string;
}

export interface Fragment {
  fragmentId: string;
  artifactId: string;
  kind: "paragraph" | "heading";
  text: string;
  path: string;
  lineStart: number;
  lineEnd: number;
}
