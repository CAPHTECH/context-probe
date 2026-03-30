import type { CommandResponse, DomainDesignScoreResult, Evidence } from "./contracts.js";
import { confidenceFromSignals, createResponse, toProvenance } from "./response.js";
import { dedupeEvidence } from "./scoring-shared.js";

export function buildDomainDesignScoreResponse(input: {
  repoPath: string;
  docsRoot?: string;
  scores: DomainDesignScoreResult["metrics"];
  leakFindings: DomainDesignScoreResult["leakFindings"];
  history: DomainDesignScoreResult["history"];
  contractUsage: {
    applicableReferences: number;
  };
  shadow?: DomainDesignScoreResult["shadow"];
  pilot?: DomainDesignScoreResult["pilot"];
  diagnostics: string[];
  unknowns: string[];
  evidence: Evidence[];
}): CommandResponse<DomainDesignScoreResult> {
  const {
    repoPath,
    docsRoot,
    scores,
    leakFindings,
    history,
    contractUsage,
    shadow,
    pilot,
    diagnostics,
    unknowns,
    evidence,
  } = input;

  return createResponse(
    {
      domainId: "domain_design",
      metrics: scores,
      leakFindings,
      history,
      crossContextReferences: contractUsage.applicableReferences,
      ...(shadow ? { shadow } : {}),
      ...(pilot ? { pilot } : {}),
    },
    {
      status: diagnostics.length > 0 ? "warning" : "ok",
      evidence: dedupeEvidence(evidence),
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: Array.from(new Set(unknowns)),
      diagnostics,
      provenance: [
        toProvenance(repoPath, "domain_design"),
        ...(docsRoot ? [toProvenance(docsRoot, "domain_design_docs")] : []),
      ],
    },
  );
}
