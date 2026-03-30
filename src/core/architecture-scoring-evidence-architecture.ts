import type { ArchitectureScoringContext } from "./architecture-scoring-types.js";
import { toEvidence } from "./response.js";

type EvidenceEntry = ReturnType<typeof toEvidence>;

export function buildDirectionEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.violations.map((violation) =>
    toEvidence(
      `${violation.sourceLayer} -> ${violation.targetLayer} direction violation`,
      {
        source: violation.source,
        target: violation.target,
      },
      undefined,
      0.95,
    ),
  );
}

export function buildPurityEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.purityScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {}),
        ...(finding.sourceLayer ? { sourceLayer: finding.sourceLayer } : {}),
        ...(finding.targetLayer ? { targetLayer: finding.targetLayer } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
}

export function buildProtocolEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.protocolScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        path: finding.path,
        ...(finding.symbol ? { symbol: finding.symbol } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
}

export function buildScenarioEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.scenarioScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        scenarioId: finding.scenarioId,
        ...(finding.observed !== undefined ? { observed: finding.observed } : {}),
        ...(finding.normalized !== undefined ? { normalized: finding.normalized } : {}),
        source: finding.source,
      },
      undefined,
      finding.confidence,
    ),
  );
}

export function buildTopologyEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.topologyScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.nodeId ? { nodeId: finding.nodeId } : {}),
        ...(finding.source ? { source: finding.source } : {}),
        ...(finding.target ? { target: finding.target } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
}

export function buildOperationsEvidence(context: ArchitectureScoringContext): EvidenceEntry[] {
  return context.operationsScore.findings.map((finding) =>
    toEvidence(
      finding.note,
      {
        kind: finding.kind,
        ...(finding.bandId ? { bandId: finding.bandId } : {}),
        ...(finding.component ? { component: finding.component } : {}),
        ...(finding.patternFamily ? { patternFamily: finding.patternFamily } : {}),
        ...(finding.signal ? { signal: finding.signal } : {}),
        ...(finding.source ? { source: finding.source } : {}),
      },
      undefined,
      finding.confidence,
    ),
  );
}
