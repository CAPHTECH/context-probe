import { toEvidence } from "./response.js";

export type EvidenceEntry = ReturnType<typeof toEvidence>;

export interface SourceConfigFinding {
  note: string;
  kind: string;
  sourceType: string;
  sourcePath?: string;
  command?: string;
  cwd?: string;
  confidence: number;
}

export interface ResolvedSourceLike {
  sourceType: string;
  resolvedPath?: string;
  command?: string;
  confidence?: number;
  findings?: SourceConfigFinding[];
}

export function buildSourceConfigEvidence(
  source: ResolvedSourceLike | undefined,
  evidenceSource: string,
): EvidenceEntry[] {
  return (source?.findings ?? []).map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        sourceType: finding.sourceType,
        ...(finding.sourcePath ? { sourcePath: finding.sourcePath } : {}),
        ...(finding.command ? { command: finding.command } : {}),
        ...(finding.cwd ? { cwd: finding.cwd } : {}),
        source: evidenceSource,
      },
      undefined,
      finding.confidence,
    ),
  );
}

export function buildSourceInputEvidence(
  source: ResolvedSourceLike | undefined,
  evidenceSource: string,
  label: string,
  confidence = 0.78,
): EvidenceEntry[] {
  if (!source) {
    return [];
  }

  return [
    toEvidence(
      `Ingested a canonical export from ${label} (${source.sourceType}).`,
      {
        source: evidenceSource,
        sourceType: source.sourceType,
        ...(source.resolvedPath ? { sourcePath: source.resolvedPath } : {}),
        ...(source.command ? { command: source.command } : {}),
      },
      undefined,
      confidence,
    ),
  ];
}
