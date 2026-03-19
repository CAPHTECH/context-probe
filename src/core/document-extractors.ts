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

const RULE_PATTERNS = [/なければならない/g, /常に/g, /\bmust\b/gi, /\bshould not\b/gi, /禁止/g];
const INVARIANT_PATTERNS = [/常に/g, /一致/g, /不変/g, /\balways\b/gi];

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
    for (const match of fragment.text.matchAll(/`([^`]+)`/g)) {
      if (match[1]) {
        pushTerm(match[1], fragment);
      }
    }
    for (const match of fragment.text.matchAll(/\b[A-Z][A-Za-z0-9_]{2,}\b/g)) {
      pushTerm(match[0], fragment);
    }
  }

  return terms;
}

function extractStatements(
  fragments: Fragment[],
  patterns: RegExp[]
): Array<{
  statement: string;
  fragment: Fragment;
}> {
  const items: Array<{
    statement: string;
    fragment: Fragment;
  }> = [];

  for (const fragment of fragments) {
    const matched = patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(fragment.text);
    });
    if (!matched) {
      continue;
    }
    items.push({
      statement: fragment.text.replace(/\s+/g, " ").trim(),
      fragment
    });
  }

  return items;
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
  return extractStatements(fragments, RULE_PATTERNS).map((item) => ({
    ruleId: createRuleId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "business_rule",
    statement: item.statement,
    confidence: 0.7,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, 0.7)],
    unknowns: [],
    fragmentIds: [item.fragment.fragmentId],
    relatedTerms: []
  }));
}

function normalizeInvariantsFromHeuristic(fragments: Fragment[]): InvariantCandidate[] {
  return extractStatements(fragments, INVARIANT_PATTERNS).map((item) => ({
    invariantId: createInvariantId(`${item.fragment.fragmentId}:${item.statement}`),
    type: "strong_invariant",
    statement: item.statement,
    confidence: 0.68,
    evidence: [createEvidenceFromFragment(item.fragment, item.statement, 0.68)],
    unknowns: [],
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
