import { createHash } from "node:crypto";

import {
  type CommandResponse,
  type CommandStatus,
  type Evidence,
  OUTPUT_VERSION,
  type ProvenanceRef
} from "./contracts.js";

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createEvidenceId(seed: string): string {
  return `EV-${createHash("sha256").update(seed).digest("hex").slice(0, 8)}`;
}

export function createResponse<T>(
  result: T,
  options?: Partial<Omit<CommandResponse<T>, "result" | "version">>
): CommandResponse<T> {
  return {
    status: options?.status ?? "ok",
    result,
    evidence: options?.evidence ?? [],
    confidence: clampConfidence(options?.confidence ?? 1),
    unknowns: options?.unknowns ?? [],
    diagnostics: options?.diagnostics ?? [],
    provenance: options?.provenance ?? [],
    version: OUTPUT_VERSION
  };
}

export function mergeStatus(...statuses: CommandStatus[]): CommandStatus {
  if (statuses.includes("error")) {
    return "error";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  return "ok";
}

export function confidenceFromSignals(signals: number[]): number {
  if (signals.length === 0) {
    return 0;
  }
  const total = signals.reduce((sum, current) => sum + clampConfidence(current), 0);
  return clampConfidence(total / signals.length);
}

export function appendDiagnostic<T>(
  response: CommandResponse<T>,
  diagnostic: string,
  status: CommandStatus = "warning"
): CommandResponse<T> {
  return {
    ...response,
    status: mergeStatus(response.status, status),
    diagnostics: [...response.diagnostics, diagnostic]
  };
}

export function toEvidence(
  statement: string,
  source: Record<string, unknown>,
  linkedEntities?: string[],
  confidence = 1
): Evidence {
  return {
    evidenceId: createEvidenceId(`${statement}:${JSON.stringify(source)}`),
    type: "derived",
    statement,
    confidence: clampConfidence(confidence),
    ...(linkedEntities ? { linkedEntities } : {}),
    source
  };
}

export function toProvenance(path: string, note?: string, line?: number): ProvenanceRef {
  return {
    path,
    ...(note ? { note } : {}),
    ...(line !== undefined ? { line } : {})
  };
}
