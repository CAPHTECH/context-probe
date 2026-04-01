import type { DomainDocsMetricContribution, DomainDocsMetricOptionsBase } from "./domain-design-scoring-docs-shared.js";
import {
  buildReviewItemsForCandidates,
  computeDrfComponents,
  inspectDrfEvidenceQuality,
} from "./domain-design-scoring-support.js";
import { evaluateFormula } from "./formula.js";
import { confidenceFromSignals } from "./response.js";
import { dedupeEvidence, toMetricScore } from "./scoring-shared.js";

export async function computeDomainDocsDrfContribution(
  options: DomainDocsMetricOptionsBase,
  formula: string,
): Promise<DomainDocsMetricContribution> {
  if (!options.docsRoot) {
    return {
      scores: [],
      evidence: [],
      diagnostics: [],
      unknowns: ["Skipped DRF because `--docs-root` was not provided."],
    };
  }

  const [rulesResult, invariantsResult] = await Promise.all([options.getRulesResult(), options.getInvariantsResult()]);
  const reviewItems = [
    ...buildReviewItemsForCandidates("rules", rulesResult.rules, rulesResult.confidence, rulesResult.unknowns),
    ...buildReviewItemsForCandidates(
      "invariants",
      invariantsResult.invariants,
      invariantsResult.confidence,
      invariantsResult.unknowns,
    ),
  ];
  const drfComponents = computeDrfComponents(
    rulesResult.fragments,
    rulesResult.rules,
    invariantsResult.invariants,
    reviewItems.length,
  );
  const drfEvidenceQuality = inspectDrfEvidenceQuality(
    rulesResult.fragments,
    rulesResult.rules,
    invariantsResult.invariants,
  );
  const drfUnknowns = [...rulesResult.unknowns, ...invariantsResult.unknowns];

  if (drfEvidenceQuality.explicitUseCaseCount === 0) {
    drfUnknowns.push("SC is an approximation based on use-case signals.");
  }
  if (drfEvidenceQuality.explicitRuleCount === 0 && drfEvidenceQuality.explicitInvariantCount === 0) {
    drfUnknowns.push("IV is an approximation based on review burden.");
  }

  if (drfComponents.totalCandidates === 0) {
    drfUnknowns.push("No rules or invariants were extracted, so DRF evidence is insufficient.");
  }
  if (drfComponents.useCaseFragments === 0) {
    drfUnknowns.push("Too little use-case-like text was found, so SC evidence is limited.");
  }

  const drfEvidence = dedupeEvidence([
    ...rulesResult.rules.flatMap((rule) => rule.evidence),
    ...invariantsResult.invariants.flatMap((invariant) => invariant.evidence),
  ]);

  return {
    scores: [
      toMetricScore(
        "DRF",
        evaluateFormula(formula, drfComponents),
        {
          SC: drfComponents.SC,
          RC: drfComponents.RC,
          IV: drfComponents.IV,
          RA: drfComponents.RA,
        },
        drfEvidence.map((entry) => entry.evidenceId),
        confidenceFromSignals([
          rulesResult.confidence,
          invariantsResult.confidence,
          drfComponents.useCaseFragments > 0 ? 0.8 : 0.55,
        ]),
        drfUnknowns,
      ),
    ],
    evidence: drfEvidence,
    diagnostics: [...rulesResult.diagnostics, ...invariantsResult.diagnostics],
    unknowns: drfUnknowns,
  };
}
