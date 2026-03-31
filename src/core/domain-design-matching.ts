function splitCamelCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function deriveTokenForms(token: string): string[] {
  const forms = new Set<string>([token]);

  if (token.endsWith("ies") && token.length > 4) {
    forms.add(`${token.slice(0, -3)}y`);
  }
  if (token.endsWith("es") && token.length > 4) {
    forms.add(token.slice(0, -2));
  }
  if (token.endsWith("s") && token.length > 3) {
    forms.add(token.slice(0, -1));
  }
  if (token.endsWith("ing") && token.length > 5) {
    forms.add(token.slice(0, -3));
  }
  if (token.endsWith("ed") && token.length > 4) {
    forms.add(token.slice(0, -2));
  }
  if (token.endsWith("ship") && token.length > 7) {
    forms.add(token.slice(0, -4));
  }
  if (token.endsWith("ment") && token.length > 7) {
    forms.add(token.slice(0, -4));
  }

  return Array.from(forms);
}

export function normalizeDomainDesignLabel(value: string): string {
  return collapseWhitespace(
    splitCamelCase(value)
      .normalize("NFKC")
      .replace(/[_/.-]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .toLowerCase(),
  );
}

function tokenizeDomainDesignLabel(value: string): string[] {
  return normalizeDomainDesignLabel(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function toComparableTokenForms(value: string): Set<string> {
  return new Set(tokenizeDomainDesignLabel(value).flatMap((token) => deriveTokenForms(token)));
}

function textContainsNormalizedLabel(text: string, label: string): boolean {
  const normalizedText = normalizeDomainDesignLabel(text);
  const normalizedLabel = normalizeDomainDesignLabel(label);
  if (normalizedText.length === 0 || normalizedLabel.length === 0) {
    return false;
  }
  return ` ${normalizedText} `.includes(` ${normalizedLabel} `);
}

function countMatchingTokens(source: string, label: string): { matched: number; total: number } {
  const sourceForms = toComparableTokenForms(source);
  const labelTokens = tokenizeDomainDesignLabel(label).filter((token) => token.length >= 3);
  if (labelTokens.length === 0) {
    return { matched: 0, total: 0 };
  }

  let matched = 0;
  for (const token of labelTokens) {
    if (deriveTokenForms(token).some((form) => sourceForms.has(form))) {
      matched += 1;
    }
  }

  return { matched, total: labelTokens.length };
}

export function scoreTextAgainstLabel(text: string, label: string): number {
  if (textContainsNormalizedLabel(text, label)) {
    return 3;
  }

  const { matched, total } = countMatchingTokens(text, label);
  if (total === 0 || matched === 0) {
    return 0;
  }
  if (matched === total) {
    return 2;
  }
  if (total >= 2 && matched / total >= 0.5) {
    return 1;
  }

  return 0;
}
