import { buildFragmentContextMentions, collectTermContexts } from "./boundary-fitness-contexts.js";
import { buildBoundaryFitnessEvidence } from "./boundary-fitness-evidence.js";
import { average, clamp01, hasSeparationSignal, unique } from "./boundary-fitness-shared.js";
import { buildAttractionSignals, localizationScore } from "./boundary-fitness-signals.js";
import type {
  BoundaryLeakFinding,
  ContractUsageReport,
  DomainModel,
  Evidence,
  Fragment,
  GlossaryTerm,
  InvariantCandidate,
  ModelCodeLink,
  RuleCandidate,
  TermTraceLink,
} from "./contracts.js";

export interface BoundaryFitnessResult {
  A: number;
  R: number;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
  diagnostics: string[];
  details: {
    localizedSignals: number;
    ambiguousSignals: number;
    explicitSeparationSignals: number;
    mappedTerms: number;
  };
}

export function computeBoundaryFitness(input: {
  model: DomainModel;
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  rules: RuleCandidate[];
  invariants: InvariantCandidate[];
  contractUsage: ContractUsageReport;
  leakFindings: BoundaryLeakFinding[];
  modelCodeLinks: ModelCodeLink[];
}): BoundaryFitnessResult {
  const computed = computeBoundaryFitnessComponents(input);

  return {
    A: computed.A,
    R: computed.R,
    confidence: computed.confidence,
    evidence: computed.evidence,
    unknowns: unique(computed.unknowns),
    diagnostics: computed.diagnostics,
    details: computed.details,
  };
}

function computeBoundaryFitnessComponents(input: {
  model: DomainModel;
  fragments: Fragment[];
  terms: GlossaryTerm[];
  links: TermTraceLink[];
  rules: RuleCandidate[];
  invariants: InvariantCandidate[];
  contractUsage: ContractUsageReport;
  leakFindings: BoundaryLeakFinding[];
  modelCodeLinks: ModelCodeLink[];
}) {
  const unknowns: string[] = [];
  const diagnostics: string[] = [];
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const termContexts = new Map(
    input.terms.map((term) => [
      term.termId,
      collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model),
    ]),
  );
  const attractionSignals = buildAttractionSignals({
    terms: input.terms,
    termContexts,
    rules: input.rules,
    invariants: input.invariants,
    fragments: input.fragments,
    fragmentContextMentions,
    model: input.model,
  });

  const localizedSignals = attractionSignals.filter((signal) => signal.contexts.length === 1);
  const ambiguousSignals = attractionSignals.filter((signal) => signal.contexts.length > 1);
  const weightedAttraction = attractionSignals.map((signal) => localizationScore(signal.contexts) * signal.confidence);
  const attractionWeight = attractionSignals.map((signal) => signal.confidence);
  const A =
    attractionSignals.length === 0
      ? 0.45
      : clamp01(
          weightedAttraction.reduce((sum, value) => sum + value, 0) /
            Math.max(
              0.0001,
              attractionWeight.reduce((sum, value) => sum + value, 0),
            ),
        );

  if (attractionSignals.length === 0) {
    unknowns.push("Terms, rules, and invariants tied to contexts are too weakly observed, so A(P) is provisional.");
  }

  const separationFragments = input.fragments.filter((fragment) => {
    const mentions = fragmentContextMentions.get(fragment.fragmentId) ?? [];
    return mentions.length >= 2 && hasSeparationSignal(fragment.text);
  });
  const explicitSeparationScore = separationFragments.length > 0 ? 1 : 0.5;
  if (separationFragments.length === 0) {
    unknowns.push(
      "Explicit separation evidence such as ownership or security is limited, so part of R(P) is approximate.",
    );
  }

  const modelCoverageScore = average(
    input.modelCodeLinks.map((link) => link.coverage),
    0.55,
  );
  const leakRatio =
    input.contractUsage.applicableReferences === 0
      ? 0
      : input.leakFindings.length / input.contractUsage.applicableReferences;
  const codeBoundaryStrength =
    input.contractUsage.applicableReferences > 0
      ? clamp01((input.contractUsage.adherence + (1 - leakRatio)) / 2)
      : clamp01(0.55 + modelCoverageScore * 0.25);
  if (input.contractUsage.applicableReferences === 0) {
    unknowns.push("There are too few cross-context references to derive strong code-level separation evidence.");
  }

  const documentSeparationScore =
    attractionSignals.length === 0 ? 0.5 : clamp01(localizedSignals.length / Math.max(1, attractionSignals.length));
  const R = clamp01(
    average([documentSeparationScore, explicitSeparationScore, codeBoundaryStrength, modelCoverageScore], 0.55),
  );

  const confidenceSignals = [
    attractionSignals.length > 0
      ? average(
          attractionSignals.map((signal) => signal.confidence),
          0.55,
        )
      : 0.5,
    separationFragments.length > 0 ? 0.8 : 0.55,
    input.model.contexts.length >= 2 ? 0.85 : 0.35,
    input.contractUsage.applicableReferences > 0 ? 0.85 : 0.6,
  ];

  if (input.model.contexts.length < 2) {
    unknowns.push("Fewer than two contexts were defined, so BFS should be interpreted carefully.");
  }
  if (input.modelCodeLinks.some((link) => link.coverage === 0)) {
    diagnostics.push("Some contexts could not be linked to code, which lowers model coverage.");
  }

  return {
    A,
    R,
    confidence: clamp01(average(confidenceSignals, 0.55)),
    evidence: buildBoundaryFitnessEvidence({
      localizedSignals,
      ambiguousSignals,
      separationFragments,
      fragmentContextMentions,
    }),
    unknowns,
    diagnostics,
    details: {
      localizedSignals: localizedSignals.length,
      ambiguousSignals: ambiguousSignals.length,
      explicitSeparationSignals: separationFragments.length,
      mappedTerms: Array.from(termContexts.values()).filter((contexts) => contexts.length > 0).length,
    },
  };
}
