import type { Token } from "./formula-parser-tokenize.js";
import { tokenize } from "./formula-parser-tokenize.js";

class FormulaParser {
  private readonly tokens: Token[];

  private index = 0;

  constructor(
    private readonly expression: string,
    private readonly variables: Record<string, number>,
  ) {
    this.tokens = tokenize(expression);
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.index < this.tokens.length) {
      throw new Error(`Unexpected token at end of expression: ${this.expression}`);
    }
    return this.ensureFinite(value);
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
      value = this.ensureFinite(operator === "+" ? value + right : value - right);
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
      value = this.ensureFinite(operator === "*" ? value * right : value / right);
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
      if (value === undefined || !Number.isFinite(value)) {
        throw new Error(`Unknown identifier "${token.value}" in formula: ${this.expression}`);
      }
      return value;
    }
    if (token.type === "operator" && token.value === "-") {
      return this.ensureFinite(-this.parseFactor());
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

  private ensureFinite(value: number): number {
    if (!Number.isFinite(value)) {
      throw new Error(`Formula produced a non-finite result: ${this.expression}`);
    }
    return value;
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

export function evaluateFormula(expression: string, variables: Record<string, number>): number {
  return new FormulaParser(expression, variables).parse();
}
