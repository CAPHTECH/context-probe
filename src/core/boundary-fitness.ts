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
  TraceLinkOccurrence
} from "./contracts.js";
import { matchGlobs } from "./io.js";
import { toEvidence } from "./response.js";

const USE_CASE_SIGNALS = [
  /ユースケース/u,
  /シナリオ/u,
  /期待(?:される)?結果/u,
  /受け入れ基準/u,
  /利用者/u,
  /\buse case\b/i,
  /\bscenario\b/i,
  /\bacceptance\b/i
];
const SEPARATION_SIGNALS = [
  /ownership/u,
  /security/u,
  /team境界/u,
  /セキュリティ/u,
  /分離/u,
  /独立/u,
  /別(?:責務|所有|境界)/u,
  /\bseparate\b/i,
  /\bseparation\b/i,
  /\boundary\b/i
];

interface BoundarySignal {
  kind: "term" | "rule" | "invariant" | "use_case";
  summary: string;
  contexts: string[];
  confidence: number;
  fragmentIds?: string[];
  linkedEntities?: string[];
}

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiLabel(value: string): boolean {
  return /^[A-Za-z0-9 _-]+$/.test(value);
}

function contextMentionPattern(name: string): RegExp | null {
  if (isAsciiLabel(name)) {
    return new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(name)}([^A-Za-z0-9_]|$)`, "i");
  }
  return null;
}

export function detectContextMentions(text: string, model: DomainModel): string[] {
  return model.contexts
    .filter((context) => {
      const pattern = contextMentionPattern(context.name);
      if (pattern) {
        return pattern.test(text);
      }
      return text.includes(context.name);
    })
    .map((context) => context.name);
}

function mapOccurrenceToContexts(occurrence: TraceLinkOccurrence, model: DomainModel): string[] {
  if (occurrence.kind !== "code") {
    return [];
  }
  return model.contexts
    .filter((context) => matchGlobs(occurrence.path, context.pathGlobs))
    .map((context) => context.name);
}

function localizationScore(contexts: string[]): number {
  if (contexts.length === 0) {
    return 0;
  }
  return 1 / contexts.length;
}

function hasUseCaseSignal(text: string): boolean {
  return USE_CASE_SIGNALS.some((pattern) => pattern.test(text));
}

function hasSeparationSignal(text: string): boolean {
  return SEPARATION_SIGNALS.some((pattern) => pattern.test(text));
}

export function buildFragmentContextMentions(fragments: Fragment[], model: DomainModel): Map<string, string[]> {
  return new Map(
    fragments.map((fragment) => [fragment.fragmentId, unique(detectContextMentions(fragment.text, model))])
  );
}

export function collectTermContexts(
  term: GlossaryTerm,
  link: TermTraceLink | undefined,
  fragmentContextMentions: Map<string, string[]>,
  model: DomainModel
): string[] {
  const contexts = new Set<string>();

  for (const occurrence of link?.occurrences ?? []) {
    for (const contextName of mapOccurrenceToContexts(occurrence, model)) {
      contexts.add(contextName);
    }
    if (occurrence.kind === "document" && occurrence.fragmentId) {
      for (const contextName of fragmentContextMentions.get(occurrence.fragmentId) ?? []) {
        contexts.add(contextName);
      }
    }
  }

  for (const fragmentId of term.fragmentIds) {
    for (const contextName of fragmentContextMentions.get(fragmentId) ?? []) {
      contexts.add(contextName);
    }
  }

  return Array.from(contexts);
}

export function collectStatementContexts(
  statement: string,
  fragmentIds: string[],
  fragmentContextMentions: Map<string, string[]>,
  mappedTerms: Array<{ canonicalTerm: string; contexts: string[] }>,
  model: DomainModel
): string[] {
  const contexts = new Set<string>();
  const normalizedStatement = statement.toLowerCase();

  for (const contextName of detectContextMentions(statement, model)) {
    contexts.add(contextName);
  }
  for (const fragmentId of fragmentIds) {
    for (const contextName of fragmentContextMentions.get(fragmentId) ?? []) {
      contexts.add(contextName);
    }
  }
  for (const term of mappedTerms) {
    if (term.contexts.length === 0) {
      continue;
    }
    if (normalizedStatement.includes(term.canonicalTerm.toLowerCase())) {
      for (const contextName of term.contexts) {
        contexts.add(contextName);
      }
    }
  }

  return Array.from(contexts);
}

function buildAttractionSignals(input: {
  terms: GlossaryTerm[];
  termContexts: Map<string, string[]>;
  rules: RuleCandidate[];
  invariants: InvariantCandidate[];
  fragments: Fragment[];
  fragmentContextMentions: Map<string, string[]>;
  model: DomainModel;
}): BoundarySignal[] {
  const mappedTerms = input.terms
    .map((term) => ({
      term,
      contexts: input.termContexts.get(term.termId) ?? []
    }))
    .filter((entry) => entry.contexts.length > 0);
  const termSummaries = mappedTerms.map((entry) => ({
    canonicalTerm: entry.term.canonicalTerm,
    contexts: entry.contexts
  }));
  const signals: BoundarySignal[] = [];

  for (const entry of mappedTerms) {
    signals.push({
      kind: "term",
      summary: entry.term.canonicalTerm,
      contexts: entry.contexts,
      confidence: entry.term.confidence,
      fragmentIds: entry.term.fragmentIds,
      linkedEntities: [entry.term.termId]
    });
  }

  for (const rule of input.rules) {
    const contexts = collectStatementContexts(
      rule.statement,
      rule.fragmentIds,
      input.fragmentContextMentions,
      termSummaries,
      input.model
    );
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "rule",
      summary: rule.statement,
      contexts,
      confidence: rule.confidence,
      fragmentIds: rule.fragmentIds,
      linkedEntities: [rule.ruleId]
    });
  }

  for (const invariant of input.invariants) {
    const contexts = collectStatementContexts(
      invariant.statement,
      invariant.fragmentIds,
      input.fragmentContextMentions,
      termSummaries,
      input.model
    );
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "invariant",
      summary: invariant.statement,
      contexts,
      confidence: invariant.confidence,
      fragmentIds: invariant.fragmentIds,
      linkedEntities: [invariant.invariantId]
    });
  }

  for (const fragment of input.fragments) {
    if (!hasUseCaseSignal(fragment.text)) {
      continue;
    }
    const contexts = input.fragmentContextMentions.get(fragment.fragmentId) ?? [];
    if (contexts.length === 0) {
      continue;
    }
    signals.push({
      kind: "use_case",
      summary: fragment.text,
      contexts,
      confidence: 0.72,
      fragmentIds: [fragment.fragmentId]
    });
  }

  return signals;
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
  const unknowns: string[] = [];
  const diagnostics: string[] = [];
  const fragmentContextMentions = buildFragmentContextMentions(input.fragments, input.model);
  const linkByTermId = new Map(input.links.map((link) => [link.termId, link]));
  const termContexts = new Map(
    input.terms.map((term) => [
      term.termId,
      collectTermContexts(term, linkByTermId.get(term.termId), fragmentContextMentions, input.model)
    ])
  );
  const attractionSignals = buildAttractionSignals({
    terms: input.terms,
    termContexts,
    rules: input.rules,
    invariants: input.invariants,
    fragments: input.fragments,
    fragmentContextMentions,
    model: input.model
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
            Math.max(0.0001, attractionWeight.reduce((sum, value) => sum + value, 0))
        );

  if (attractionSignals.length === 0) {
    unknowns.push("context に紐づく用語・ルール・不変条件が十分に観測できず A(P) は暫定値です");
  }

  const separationFragments = input.fragments.filter((fragment) => {
    const mentions = fragmentContextMentions.get(fragment.fragmentId) ?? [];
    return mentions.length >= 2 && hasSeparationSignal(fragment.text);
  });
  const explicitSeparationScore = separationFragments.length > 0 ? 1 : 0.5;
  if (separationFragments.length === 0) {
    unknowns.push("ownership/security などの明示的な分離根拠が少なく R(P) の一部は近似です");
  }

  const modelCoverageScore = average(input.modelCodeLinks.map((link) => link.coverage), 0.55);
  const leakRatio =
    input.contractUsage.applicableReferences === 0
      ? 0
      : input.leakFindings.length / input.contractUsage.applicableReferences;
  const codeBoundaryStrength =
    input.contractUsage.applicableReferences > 0
      ? clamp01((input.contractUsage.adherence + (1 - leakRatio)) / 2)
      : clamp01(0.55 + modelCoverageScore * 0.25);
  if (input.contractUsage.applicableReferences === 0) {
    unknowns.push("cross-context 参照が少なくコード上の分離根拠は限定的です");
  }

  const documentSeparationScore =
    attractionSignals.length === 0
      ? 0.5
      : clamp01(localizedSignals.length / Math.max(1, attractionSignals.length));
  const R = clamp01(average([documentSeparationScore, explicitSeparationScore, codeBoundaryStrength, modelCoverageScore], 0.55));

  const evidence: Evidence[] = [];

  for (const signal of localizedSignals.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${signal.summary.slice(0, 120)} is localized to ${signal.contexts[0]}`,
        {
          kind: signal.kind,
          contexts: signal.contexts,
          fragmentIds: signal.fragmentIds ?? []
        },
        signal.linkedEntities,
        clamp01(signal.confidence)
      )
    );
  }
  for (const signal of ambiguousSignals.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${signal.summary.slice(0, 120)} spans ${signal.contexts.join(", ")}`,
        {
          kind: signal.kind,
          contexts: signal.contexts,
          fragmentIds: signal.fragmentIds ?? []
        },
        signal.linkedEntities,
        clamp01(Math.min(signal.confidence, 0.82))
      )
    );
  }
  for (const fragment of separationFragments.slice(0, 4)) {
    evidence.push(
      toEvidence(
        `${fragment.text.slice(0, 120)} confirms separation`,
        {
          fragmentId: fragment.fragmentId,
          path: fragment.path,
          contexts: fragmentContextMentions.get(fragment.fragmentId) ?? []
        },
        undefined,
        0.84
      )
    );
  }

  const confidenceSignals = [
    attractionSignals.length > 0 ? average(attractionSignals.map((signal) => signal.confidence), 0.55) : 0.5,
    separationFragments.length > 0 ? 0.8 : 0.55,
    input.model.contexts.length >= 2 ? 0.85 : 0.35,
    input.contractUsage.applicableReferences > 0 ? 0.85 : 0.6
  ];

  if (input.model.contexts.length < 2) {
    unknowns.push("context が 2 つ未満のため BFS の解釈に注意が必要です");
  }
  if (input.modelCodeLinks.some((link) => link.coverage === 0)) {
    diagnostics.push("一部の context に対応するコードが見つからず model coverage が低下しています");
  }

  return {
    A,
    R,
    confidence: clamp01(average(confidenceSignals, 0.55)),
    evidence,
    unknowns: unique(unknowns),
    diagnostics,
    details: {
      localizedSignals: localizedSignals.length,
      ambiguousSignals: ambiguousSignals.length,
      explicitSeparationSignals: separationFragments.length,
      mappedTerms: Array.from(termContexts.values()).filter((contexts) => contexts.length > 0).length
    }
  };
}
