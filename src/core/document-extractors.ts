import type {
  ExtractionBackend,
  ExtractionKind,
  ExtractionMetadata,
  ExtractionProviderName,
  Fragment,
  GlossaryTerm,
  InvariantCandidate,
  RuleCandidate,
  ReviewResolutionLog
} from "./contracts.js";
import { normalizeDocuments } from "./artifacts.js";
import { applyReviewOverrides } from "./review.js";
import { runCliExtraction } from "./providers.js";
import { createEvidenceId } from "./response.js";

interface ExtractionOptions {
  root: string;
  cwd: string;
  extractor?: ExtractionBackend;
  provider?: ExtractionProviderName;
  providerCommand?: string;
  promptProfile?: string;
  fallback?: "heuristic" | "none";
  reviewLog?: ReviewResolutionLog;
  applyReviewLog?: boolean;
}

interface HeuristicTermCandidate {
  canonicalTerm: string;
  count: number;
  evidence: GlossaryTerm["evidence"];
  fragmentIds: string[];
}

interface HeuristicStatementCandidate {
  statement: string;
  fragment: Fragment;
  confidence: number;
  unknowns: string[];
  sourceKind: "sentence" | "bullet";
}

interface StatementSegment {
  text: string;
  sourceKind: "sentence" | "bullet";
}

const RULE_SIGNALS = [
  /なければならない/u,
  /べき/u,
  /\bmust\b/i,
  /\bmust not\b/i,
  /\bshould not\b/i,
  /禁止/u,
  /行わない/u,
  /残さない/u
];
const INVARIANT_SIGNALS = [
  /常に/u,
  /一致/u,
  /不変/u,
  /\balways\b/i,
  /一意/u,
  /整合/u,
  /返(?:る|される)/u,
  /欠落しない/u,
  /再現可能/u,
  /安定(?:する|している)/u,
  /辿れる/u,
  /反映(?:される|されている)/u,
  /付与(?:される|されている)/u,
  /表示(?:される|されている)/u
];
const RULE_PREDICATE_PATTERNS = [
  /なければならない[。.]?$/u,
  /べき[。.]?$/u,
  /\bmust\b/i,
  /\bmust not\b/i,
  /\bshould not\b/i,
  /選択できる[。.]?$/u,
  /行わない[。.]?$/u,
  /残さない[。.]?$/u,
  /持つ[。.]?$/u,
  /従う[。.]?$/u,
  /守る[。.]?$/u
];
const INVARIANT_PREDICATE_PATTERNS = [
  /である[。.]?$/u,
  /不変である[。.]?$/u,
  /一致(?:して(?:いる|いなければならない)|する)[。.]?$/u,
  /返(?:る|される)[。.]?$/u,
  /一意である[。.]?$/u,
  /整合(?:して(?:いる|いなければならない)|する)[。.]?$/u,
  /欠落しない[。.]?$/u,
  /再現可能である/u,
  /安定(?:する|している)[。.]?$/u,
  /辿れる[。.]?$/u,
  /反映(?:される|されている)[。.]?$/u,
  /付与(?:される|されている)[。.]?$/u,
  /表示(?:される|されている)[。.]?$/u,
  /保た(?:れる|れている)[。.]?$/u,
  /維持(?:される|している|する)?[。.]?$/u,
  /成立(?:する|している)?[。.]?$/u,
  /閉じ(?:ている|る)[。.]?$/u,
  /\balways\b.+\b(is|are|returns?|holds?)\b/i
];
const RULE_INVARIANT_AMBIGUITY = "rule と invariant の境界が曖昧です";
const INVARIANT_ACCEPTANCE_AMBIGUITY = "invariant と受け入れ条件の境界が曖昧です";
const INVARIANT_REVIEW_SIGNALS = [
  /返(?:る|される)/u,
  /表示(?:される|されている)/u,
  /反映(?:される|されている)/u,
  /付与(?:される|されている)/u,
  /欠落しない/u
];
const STRUCTURAL_GLOSSARY_FLAG_PATTERN = /^--[a-z0-9][a-z0-9-]*$/;
const STRUCTURAL_GLOSSARY_FILE_SUFFIX_PATTERN = /\.(?:ts|tsx|js|mjs|md|yaml|yml|json)$/i;
const STRUCTURAL_GLOSSARY_ID_PATTERN = /^(?:ART|FRG|TERM|RULE|INV|EV|RUN|RV)-[A-Za-z0-9._-]+$/;
const STRUCTURAL_GLOSSARY_RESPONSE_PATH_PATTERN = /^(?:result|response)\.[A-Za-z0-9_*.-]+$/;
const STRUCTURAL_GLOSSARY_SNAKE_CASE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

function isStructuredNoiseFragment(fragment: Fragment): boolean {
  const trimmed = fragment.text.trim();
  if (trimmed.startsWith("```") || trimmed.includes("\n```")) {
    return true;
  }
  return trimmed
    .split("\n")
    .filter(Boolean)
    .every((line) => line.trim().startsWith("|"));
}

function isStructuralGlossaryNoise(term: string): boolean {
  return (
    STRUCTURAL_GLOSSARY_FLAG_PATTERN.test(term) ||
    term.includes("/") ||
    STRUCTURAL_GLOSSARY_FILE_SUFFIX_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_ID_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_RESPONSE_PATH_PATTERN.test(term) ||
    STRUCTURAL_GLOSSARY_SNAKE_CASE_PATTERN.test(term)
  );
}

function normalizeInlineTerm(term: string): string | undefined {
  const normalized = term.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("\n")) {
    return undefined;
  }
  if (normalized.length > 80) {
    return undefined;
  }
  if (normalized.split(/\s+/).length > 4) {
    return undefined;
  }
  if (isStructuralGlossaryNoise(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeStatement(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

function isListItemLine(line: string): boolean {
  return /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function stripListMarker(line: string): string {
  return line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function buildMetadata(options: ExtractionOptions): ExtractionMetadata {
  return {
    extractor: options.extractor ?? "heuristic",
    ...(options.provider ? { provider: options.provider } : {}),
    promptProfile: options.promptProfile ?? "default",
    fallback: options.fallback ?? "heuristic"
  };
}

function createTermId(seed: string): string {
  return `TERM-${createEvidenceId(seed).replace("EV-", "")}`;
}

function createRuleId(seed: string): string {
  return `RULE-${createEvidenceId(seed).replace("EV-", "")}`;
}

function createInvariantId(seed: string): string {
  return `INV-${createEvidenceId(seed).replace("EV-", "")}`;
}

function createEvidenceFromFragment(fragment: Fragment, statement: string, confidence: number) {
  return {
    evidenceId: createEvidenceId(`${fragment.fragmentId}:${statement}`),
    type: "document_fragment",
    statement,
    confidence,
    source: {
      artifactId: fragment.artifactId,
      fragmentId: fragment.fragmentId,
      path: fragment.path
    }
  };
}

function findFragmentsByIds(fragments: Fragment[], fragmentIds: string[]): Fragment[] {
  const fragmentMap = new Map(fragments.map((fragment) => [fragment.fragmentId, fragment]));
  return fragmentIds
    .map((fragmentId) => fragmentMap.get(fragmentId))
    .filter((fragment): fragment is Fragment => Boolean(fragment));
}

function collectTerms(fragments: Fragment[]): Map<string, HeuristicTermCandidate> {
  const terms = new Map<string, HeuristicTermCandidate>();
  const pushTerm = (term: string, fragment: Fragment) => {
    if (term.length < 3) {
      return;
    }
    const current = terms.get(term) ?? {
      canonicalTerm: term,
      count: 0,
      evidence: [],
      fragmentIds: []
    };
    current.count += 1;
    current.fragmentIds.push(fragment.fragmentId);
    current.evidence.push(createEvidenceFromFragment(fragment, `Term candidate: ${term}`, 0.7));
    terms.set(term, current);
  };

  for (const fragment of fragments) {
    if (isStructuredNoiseFragment(fragment)) {
      continue;
    }
    for (const match of fragment.text.matchAll(/`([^`]+)`/g)) {
      const normalized = match[1] ? normalizeInlineTerm(match[1]) : undefined;
      if (normalized) {
        pushTerm(normalized, fragment);
      }
    }
    for (const match of fragment.text.matchAll(/\b[A-Z][A-Za-z0-9_]{2,}\b/g)) {
      const normalized = normalizeInlineTerm(match[0]);
      if (normalized) {
        pushTerm(normalized, fragment);
      }
    }
  }

  return terms;
}

function splitIntoSentences(text: string): string[] {
  const normalized = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/(?<=[。！？])\s*|(?<=[!?])\s+|(?<=\.)\s+/u)
    .map((sentence) => normalizeStatement(sentence))
    .filter(Boolean);
}

function hasAnySignal(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasPredicateShape(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function buildInvariantReviewState(
  statement: string,
  sourceKind: "sentence" | "bullet"
): Pick<HeuristicStatementCandidate, "confidence" | "unknowns"> {
  const bulletPenalty = sourceKind === "bullet" ? 0.06 : 0;
  if (hasAnySignal(statement, INVARIANT_REVIEW_SIGNALS)) {
    return {
      confidence: 0.68 - bulletPenalty,
      unknowns: [INVARIANT_ACCEPTANCE_AMBIGUITY]
    };
  }
  return {
    confidence: 0.82 - bulletPenalty,
    unknowns: []
  };
}

function isQuestionLikeStatement(text: string): boolean {
  return /[か？?][。.]?$/u.test(text);
}

function buildStatementSegments(fragment: Fragment): StatementSegment[] {
  const segments: StatementSegment[] = [];
  const proseBuffer: string[] = [];

  const flushProse = () => {
    if (proseBuffer.length === 0) {
      return;
    }
    splitIntoSentences(proseBuffer.join(" ")).forEach((sentence) => {
      segments.push({
        text: sentence,
        sourceKind: "sentence"
      });
    });
    proseBuffer.length = 0;
  };

  for (const rawLine of fragment.text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushProse();
      continue;
    }
    if (isListItemLine(line)) {
      flushProse();
      const bullet = normalizeStatement(stripListMarker(line));
      if (bullet) {
        segments.push({
          text: bullet,
          sourceKind: "bullet"
        });
      }
      continue;
    }
    proseBuffer.push(line);
  }

  flushProse();
  return segments;
}

function classifyStatement(
  statement: string,
  fragment: Fragment,
  sourceKind: "sentence" | "bullet"
): { kind: "rule" | "invariant"; item: HeuristicStatementCandidate } | undefined {
  const normalized = normalizeStatement(statement);
  if (!normalized || isQuestionLikeStatement(normalized)) {
    return undefined;
  }

  const hasRuleSignal = hasAnySignal(normalized, RULE_SIGNALS);
  const hasInvariantSignal = hasAnySignal(normalized, INVARIANT_SIGNALS);
  const hasRulePredicate = hasPredicateShape(normalized, RULE_PREDICATE_PATTERNS);
  const hasInvariantPredicate = hasPredicateShape(normalized, INVARIANT_PREDICATE_PATTERNS);

  if ((!hasRuleSignal || !hasRulePredicate) && (!hasInvariantSignal || !hasInvariantPredicate)) {
    return undefined;
  }

  const bulletPenalty = sourceKind === "bullet" ? 0.06 : 0;

  if (hasInvariantSignal && hasInvariantPredicate && (!hasRuleSignal || !hasRulePredicate)) {
    const invariantReviewState = buildInvariantReviewState(normalized, sourceKind);
    return {
      kind: "invariant",
      item: {
        statement: normalized,
        fragment,
        confidence: invariantReviewState.confidence,
        unknowns: invariantReviewState.unknowns,
        sourceKind
      }
    };
  }

  if (hasRuleSignal && hasRulePredicate && hasInvariantSignal && !hasInvariantPredicate) {
    return {
      kind: "rule",
      item: {
        statement: normalized,
        fragment,
        confidence: 0.62 - bulletPenalty,
        unknowns: [RULE_INVARIANT_AMBIGUITY],
        sourceKind
      }
    };
  }

  if (hasRuleSignal && hasRulePredicate && (!hasInvariantSignal || !hasInvariantPredicate)) {
    return {
      kind: "rule",
      item: {
        statement: normalized,
        fragment,
        confidence: 0.78 - bulletPenalty,
        unknowns: [],
        sourceKind
      }
    };
  }

  return {
    kind: hasInvariantPredicate ? "invariant" : "rule",
    item: {
      statement: normalized,
      fragment,
      confidence: 0.62 - bulletPenalty,
      unknowns: [RULE_INVARIANT_AMBIGUITY],
      sourceKind
    }
  };
}

function classifyHeuristicStatements(fragments: Fragment[]): {
  rules: HeuristicStatementCandidate[];
  invariants: HeuristicStatementCandidate[];
} {
  const rules: HeuristicStatementCandidate[] = [];
  const invariants: HeuristicStatementCandidate[] = [];
  const seen = new Set<string>();

  for (const fragment of fragments) {
    if (fragment.kind !== "paragraph" || isStructuredNoiseFragment(fragment)) {
      continue;
    }
    for (const segment of buildStatementSegments(fragment)) {
      const classified = classifyStatement(segment.text, fragment, segment.sourceKind);
      if (!classified) {
        continue;
      }
      const dedupeKey = `${classified.kind}:${fragment.fragmentId}:${classified.item.statement}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      if (classified.kind === "rule") {
        rules.push(classified.item);
      } else {
        invariants.push(classified.item);
      }
    }
  }

  return { rules, invariants };
}

function normalizeGlossaryFromHeuristic(fragments: Fragment[]): GlossaryTerm[] {
  return Array.from(collectTerms(fragments).values())
    .sort((left, right) => right.count - left.count)
    .map((candidate) => ({
      termId: createTermId(`${candidate.canonicalTerm}:${candidate.fragmentIds.join(",")}`),
      canonicalTerm: candidate.canonicalTerm,
      aliases: [],
      count: candidate.count,
      collision: false,
      confidence: 0.7,
      evidence: candidate.evidence,
      unknowns: [],
      fragmentIds: candidate.fragmentIds
    }));
}

function normalizeRulesFromHeuristic(fragments: Fragment[]): RuleCandidate[] {
  return classifyHeuristicStatements(fragments).rules.map((item) => ({
    ruleId: createRuleId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "business_rule",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: []
  }));
}

function normalizeInvariantsFromHeuristic(fragments: Fragment[]): InvariantCandidate[] {
  return classifyHeuristicStatements(fragments).invariants.map((item) => ({
    invariantId: createInvariantId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "strong_invariant",
    statement: item.statement,
    confidence: item.confidence,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, item.confidence)],
    unknowns: item.unknowns,
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: []
  }));
}

function normalizeGlossaryFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): GlossaryTerm[] {
  return rawItems
    .filter((item) => typeof item.canonicalTerm === "string")
    .map((item) => {
      const canonicalTerm = item.canonicalTerm as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      return {
        termId: createTermId(`${canonicalTerm}:${fragmentIds.join(",")}`),
        canonicalTerm,
        aliases: Array.isArray(item.aliases) ? item.aliases.filter((value): value is string => typeof value === "string") : [],
        count: fragmentIds.length || 1,
        collision: Boolean(item.collision),
        confidence: typeof item.confidence === "number" ? item.confidence : 0.7,
        evidence: supportingFragments.map((fragment) =>
          createEvidenceFromFragment(fragment, `Term candidate: ${canonicalTerm}`, typeof item.confidence === "number" ? item.confidence : 0.7)
        ),
        unknowns: Array.isArray(item.unknowns) ? item.unknowns.filter((value): value is string => typeof value === "string") : [],
        fragmentIds
      };
    });
}

function normalizeRulesFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): RuleCandidate[] {
  return rawItems
    .filter((item) => typeof item.statement === "string")
    .map((item) => {
      const statement = item.statement as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      const confidence = typeof item.confidence === "number" ? item.confidence : 0.7;
      return {
        ruleId: createRuleId(`${statement}:${fragmentIds.join(",")}`),
        type: typeof item.type === "string" ? item.type : "business_rule",
        statement,
        confidence,
        evidence: supportingFragments.map((fragment) => createEvidenceFromFragment(fragment, statement, confidence)),
        unknowns: Array.isArray(item.unknowns) ? item.unknowns.filter((value): value is string => typeof value === "string") : [],
        fragmentIds,
        relatedTerms: Array.isArray(item.relatedTerms)
          ? item.relatedTerms.filter((value): value is string => typeof value === "string")
          : []
      };
    });
}

function normalizeInvariantsFromCli(rawItems: Record<string, unknown>[], fragments: Fragment[]): InvariantCandidate[] {
  return rawItems
    .filter((item) => typeof item.statement === "string")
    .map((item) => {
      const statement = item.statement as string;
      const fragmentIds = Array.isArray(item.fragmentIds)
        ? item.fragmentIds.filter((value): value is string => typeof value === "string")
        : [];
      const supportingFragments = findFragmentsByIds(fragments, fragmentIds);
      const confidence = typeof item.confidence === "number" ? item.confidence : 0.68;
      return {
        invariantId: createInvariantId(`${statement}:${fragmentIds.join(",")}`),
        type: typeof item.type === "string" ? item.type : "strong_invariant",
        statement,
        confidence,
        evidence: supportingFragments.map((fragment) => createEvidenceFromFragment(fragment, statement, confidence)),
        unknowns: Array.isArray(item.unknowns) ? item.unknowns.filter((value): value is string => typeof value === "string") : [],
        fragmentIds,
        relatedTerms: Array.isArray(item.relatedTerms)
          ? item.relatedTerms.filter((value): value is string => typeof value === "string")
          : []
      };
    });
}

async function extractWithProvider(kind: ExtractionKind, fragments: Fragment[], options: ExtractionOptions) {
  if (!options.provider) {
    throw new Error("CLI extractor requires `provider`");
  }
  const providerResult = await runCliExtraction({
    cwd: options.cwd,
    provider: options.provider,
    kind,
    promptProfile: options.promptProfile ?? "default",
    fragments,
    ...(options.providerCommand ? { providerCommand: options.providerCommand } : {})
  });

  if (kind === "glossary") {
    return {
      items: normalizeGlossaryFromCli(providerResult.items, fragments),
      confidence: providerResult.confidence,
      unknowns: providerResult.unknowns,
      diagnostics: providerResult.diagnostics,
      provider: providerResult.provider
    };
  }
  if (kind === "rules") {
    return {
      items: normalizeRulesFromCli(providerResult.items, fragments),
      confidence: providerResult.confidence,
      unknowns: providerResult.unknowns,
      diagnostics: providerResult.diagnostics,
      provider: providerResult.provider
    };
  }
  return {
    items: normalizeInvariantsFromCli(providerResult.items, fragments),
    confidence: providerResult.confidence,
    unknowns: providerResult.unknowns,
    diagnostics: providerResult.diagnostics,
    provider: providerResult.provider
  };
}

function applyGlossaryReview(
  items: GlossaryTerm[],
  options: ExtractionOptions
): GlossaryTerm[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "termId") : items;
}

function applyRulesReview(
  items: RuleCandidate[],
  options: ExtractionOptions
): RuleCandidate[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "ruleId") : items;
}

function applyInvariantsReview(
  items: InvariantCandidate[],
  options: ExtractionOptions
): InvariantCandidate[] {
  return options.applyReviewLog ? applyReviewOverrides(items, options.reviewLog, "invariantId") : items;
}

export async function extractGlossary(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("glossary", fragments, options);
      return {
        fragments,
        terms: applyGlossaryReview(extracted.items as GlossaryTerm[], options),
        metadata: {
          ...metadata,
          provider: extracted.provider
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const terms = normalizeGlossaryFromHeuristic(fragments);
      return {
        fragments,
        terms: applyGlossaryReview(terms, options),
        metadata,
        confidence: 0.55,
        unknowns: ["CLI extractor に失敗したため heuristic fallback を使用しました"],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"]
      };
    }
  }

  const terms = normalizeGlossaryFromHeuristic(fragments);
  return {
    fragments,
    terms: applyGlossaryReview(terms, options),
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: []
  };
}

export async function extractRules(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("rules", fragments, options);
      return {
        rules: applyRulesReview(extracted.items as RuleCandidate[], options),
        fragments,
        metadata: {
          ...metadata,
          provider: extracted.provider
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const rules = normalizeRulesFromHeuristic(fragments);
      return {
        rules: applyRulesReview(rules, options),
        fragments,
        metadata,
        confidence: 0.55,
        unknowns: ["CLI extractor に失敗したため heuristic fallback を使用しました"],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"]
      };
    }
  }

  const rules = normalizeRulesFromHeuristic(fragments);
  return {
    rules: applyRulesReview(rules, options),
    fragments,
    metadata,
    confidence: 0.7,
    unknowns: [],
    diagnostics: []
  };
}

export async function extractInvariants(options: ExtractionOptions) {
  const metadata = buildMetadata(options);
  const fragments = await normalizeDocuments(options.root);
  const fallback = options.fallback ?? "heuristic";

  if (metadata.extractor === "cli") {
    try {
      const extracted = await extractWithProvider("invariants", fragments, options);
      return {
        invariants: applyInvariantsReview(extracted.items as InvariantCandidate[], options),
        fragments,
        metadata: {
          ...metadata,
          provider: extracted.provider
        },
        confidence: extracted.confidence,
        unknowns: extracted.unknowns,
        diagnostics: extracted.diagnostics
      };
    } catch (error) {
      if (fallback === "none") {
        throw error;
      }
      const invariants = normalizeInvariantsFromHeuristic(fragments);
      return {
        invariants: applyInvariantsReview(invariants, options),
        fragments,
        metadata,
        confidence: 0.55,
        unknowns: ["CLI extractor に失敗したため heuristic fallback を使用しました"],
        diagnostics: [error instanceof Error ? error.message : "CLI extractor failed"]
      };
    }
  }

  const invariants = normalizeInvariantsFromHeuristic(fragments);
  return {
    invariants: applyInvariantsReview(invariants, options),
    fragments,
    metadata,
    confidence: 0.68,
    unknowns: [],
    diagnostics: []
  };
}
