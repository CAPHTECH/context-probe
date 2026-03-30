import type { CommandResponse, DomainDesignScoreResult, Evidence } from "./contracts.js";
import {
  buildDomainDesignScoreResponseOptions,
  buildDomainDesignScoreResult,
} from "./domain-design-scoring-response-shared.js";
import { createResponse } from "./response.js";

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
  const responseOptions: Parameters<typeof buildDomainDesignScoreResponseOptions>[0] = {
    repoPath,
    scores,
    diagnostics,
    unknowns,
    evidence,
  };
  if (docsRoot !== undefined) {
    responseOptions.docsRoot = docsRoot;
  }

  return createResponse(
    buildDomainDesignScoreResult({
      scores,
      leakFindings,
      history,
      contractUsage,
      shadow,
      pilot,
    }),
    buildDomainDesignScoreResponseOptions(responseOptions),
  );
}
