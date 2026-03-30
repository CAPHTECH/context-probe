import type { CommandResponse, CommandStatus, DomainDesignScoreResult, Evidence, ProgressUpdate } from "./contracts.js";
import { confidenceFromSignals, toProvenance } from "./response.js";
import { dedupeEvidence } from "./scoring-shared.js";

export function buildDomainDesignScoreResult(input: {
  scores: DomainDesignScoreResult["metrics"];
  leakFindings: DomainDesignScoreResult["leakFindings"];
  history: DomainDesignScoreResult["history"];
  contractUsage: {
    applicableReferences: number;
  };
  shadow?: DomainDesignScoreResult["shadow"];
  pilot?: DomainDesignScoreResult["pilot"];
}): DomainDesignScoreResult {
  const { scores, leakFindings, history, contractUsage, shadow, pilot } = input;

  return {
    domainId: "domain_design",
    metrics: scores,
    leakFindings,
    history,
    crossContextReferences: contractUsage.applicableReferences,
    ...(shadow ? { shadow } : {}),
    ...(pilot ? { pilot } : {}),
  };
}

export function buildDomainDesignScoreResponseOptions(input: {
  repoPath: string;
  docsRoot?: string;
  scores: DomainDesignScoreResult["metrics"];
  diagnostics: string[];
  progress: ProgressUpdate[];
  unknowns: string[];
  evidence: Evidence[];
}): Partial<Omit<CommandResponse<DomainDesignScoreResult>, "result" | "version">> {
  const { repoPath, docsRoot, scores, diagnostics, progress, unknowns, evidence } = input;
  const status: CommandStatus = diagnostics.length > 0 ? "warning" : "ok";

  return {
    status,
    evidence: dedupeEvidence(evidence),
    confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
    unknowns: Array.from(new Set(unknowns)),
    diagnostics,
    progress,
    provenance: [
      toProvenance(repoPath, "domain_design"),
      ...(docsRoot !== undefined ? [toProvenance(docsRoot, "domain_design_docs")] : []),
    ],
  };
}
