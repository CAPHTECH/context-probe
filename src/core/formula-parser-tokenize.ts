export type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < expression.length) {
    const char = expression[cursor];
    if (char === undefined) {
      break;
    }
    if (char === " " || char === "\n" || char === "\t") {
      cursor += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      cursor += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      cursor += 1;
      continue;
    }
    if (/\d/.test(char)) {
      const remaining = expression.slice(cursor);
      const match = /^\d+(?:\.\d*)?/u.exec(remaining);
      const literal = match?.[0];
      if (!literal) {
        throw new Error(`Invalid numeric literal in formula: ${expression}`);
      }
      cursor += literal.length;
      if (expression[cursor] === ".") {
        throw new Error(`Invalid numeric literal in formula: ${expression}`);
      }
      const numericValue = Number(literal);
      if (!Number.isFinite(numericValue)) {
        throw new Error(`Invalid numeric literal in formula: ${expression}`);
      }
      tokens.push({ type: "number", value: numericValue });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let identifier = char;
      cursor += 1;
      while (cursor < expression.length && /[A-Za-z0-9_]/.test(expression[cursor] ?? "")) {
        const nextChar = expression[cursor];
        if (!nextChar) {
          break;
        }
        identifier += nextChar;
        cursor += 1;
      }
      tokens.push({ type: "identifier", value: identifier });
      continue;
    }
    throw new Error(`Unsupported character "${char}" in formula: ${expression}`);
  }

  return tokens;
}
