import type { TermTraceLink } from "./contracts.js";

function computeAliasEntropy(aliasesPerTerm: number, termCount: number): number {
  if (termCount === 0) {
    return 1;
  }
  return Math.min(1, aliasesPerTerm / termCount);
}

export function computeUliComponents(
  terms: Array<{ termId: string; count: number; aliases: string[]; collision: boolean }>,
  links: TermTraceLink[],
) {
  const totalTerms = terms.length;
  if (totalTerms === 0) {
    return {
      GC: 0,
      AE: 1,
      TC: 1,
      TL: 0,
    };
  }

  const linkByTermId = new Map(links.map((link) => [link.termId, link]));
  const glossaryCovered = terms.filter((term) => {
    const link = linkByTermId.get(term.termId);
    return term.count > 1 || (link?.coverage.codeHits ?? 0) > 0;
  }).length;
  const tracedTerms = links.filter((link) => link.coverage.documentHits > 0 && link.coverage.codeHits > 0).length;
  const collisionTerms = terms.filter((term) => term.collision).length;
  const aliasCount = terms.reduce((sum, term) => sum + term.aliases.length, 0);

  return {
    GC: glossaryCovered / totalTerms,
    AE: computeAliasEntropy(aliasCount, totalTerms),
    TC: collisionTerms / totalTerms,
    TL: tracedTerms / totalTerms,
  };
}
