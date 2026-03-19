type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

class FormulaParser {
  private readonly tokens: Token[];

  private index = 0;

  constructor(private readonly expression: string, private readonly variables: Record<string, number>) {
    this.tokens = tokenize(expression);
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.index < this.tokens.length) {
      throw new Error(`Unexpected token at end of expression: ${this.expression}`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.peekOperator("+") || this.peekOperator("-")) {
      const token = this.consume();
      if (!token || token.type !== "operator") {
        throw new Error(`Expected operator in formula: ${this.expression}`);
      }
      const operator = token.value;
      const right = this.parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peekOperator("*") || this.peekOperator("/")) {
      const token = this.consume();
      if (!token || token.type !== "operator") {
        throw new Error(`Expected operator in formula: ${this.expression}`);
      }
      const operator = token.value;
      const right = this.parseFactor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  private parseFactor(): number {
    const token = this.consume();
    if (!token) {
      throw new Error(`Unexpected end of expression: ${this.expression}`);
    }
    if (token.type === "number") {
      return token.value;
    }
    if (token.type === "identifier") {
      const value = this.variables[token.value];
      if (!Number.isFinite(value)) {
        throw new Error(`Unknown identifier "${token.value}" in formula: ${this.expression}`);
      }
      return value!;
    }
    if (token.type === "operator" && token.value === "-") {
      return -this.parseFactor();
    }
    if (token.type === "paren" && token.value === "(") {
      const nested = this.parseExpression();
      const next = this.consume();
      if (!next || next.type !== "paren" || next.value !== ")") {
        throw new Error(`Missing closing parenthesis in formula: ${this.expression}`);
      }
      return nested;
    }
    throw new Error(`Unexpected token in formula: ${JSON.stringify(token)}`);
  }

  private peekOperator(operator: "+" | "-" | "*" | "/"): boolean {
    const token = this.tokens[this.index];
    return token?.type === "operator" && token.value === operator;
  }

  private consume(): Token | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

function tokenize(expression: string): Token[] {
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
      let value = char;
      cursor += 1;
      while (cursor < expression.length && /[\d.]/.test(expression[cursor] ?? "")) {
        const nextChar = expression[cursor];
        if (!nextChar) {
          break;
        }
        value += nextChar;
        cursor += 1;
      }
      tokens.push({ type: "number", value: Number(value) });
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

export function evaluateFormula(expression: string, variables: Record<string, number>): number {
  return new FormulaParser(expression, variables).parse();
}
