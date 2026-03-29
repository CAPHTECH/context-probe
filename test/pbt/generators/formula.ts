import fc from "fast-check";

const FORMULA_VARIABLE_NAMES = ["A", "B", "C", "X", "Y", "Z"] as const;

type FormulaVariableName = (typeof FORMULA_VARIABLE_NAMES)[number];

export type FormulaAst =
  | { kind: "constant"; value: number }
  | { kind: "variable"; name: FormulaVariableName }
  | { kind: "negate"; operand: FormulaAst }
  | { kind: "binary"; operator: "+" | "-" | "*"; left: FormulaAst; right: FormulaAst };

const formulaLeafArbitrary: fc.Arbitrary<FormulaAst> = fc.oneof(
  fc.integer({ min: 0, max: 9 }).map((value) => ({ kind: "constant", value }) as const),
  fc.constantFrom(...FORMULA_VARIABLE_NAMES).map((name) => ({ kind: "variable", name }) as const),
);

function createFormulaAstArbitrary(depth: number): fc.Arbitrary<FormulaAst> {
  if (depth <= 0) {
    return formulaLeafArbitrary;
  }

  const child = createFormulaAstArbitrary(depth - 1);
  return fc.oneof(
    formulaLeafArbitrary,
    child.map((operand) => ({ kind: "negate", operand }) as const),
    fc
      .tuple(fc.constantFrom("+" as const, "-" as const, "*" as const), child, child)
      .map(([operator, left, right]) => ({ kind: "binary", operator, left, right }) as const),
  );
}

export const formulaAstArbitrary: fc.Arbitrary<FormulaAst> = fc
  .integer({ min: 0, max: 3 })
  .chain((depth) => createFormulaAstArbitrary(depth));

export const formulaVariablesArbitrary = fc.record({
  A: fc.integer({ min: -5, max: 5 }),
  B: fc.integer({ min: -5, max: 5 }),
  C: fc.integer({ min: -5, max: 5 }),
  X: fc.integer({ min: -5, max: 5 }),
  Y: fc.integer({ min: -5, max: 5 }),
  Z: fc.integer({ min: -5, max: 5 }),
});

const whitespaceArbitrary = fc.constantFrom("", " ", "\t", "\n", " \n ", "\t ");

const digitArbitrary = fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
const digitsArbitrary = fc.array(digitArbitrary, { minLength: 1, maxLength: 4 }).map((digits) => digits.join(""));

export const whitespaceFunctionArbitrary = fc.func(whitespaceArbitrary);
export const invalidNumericLiteralArbitrary = fc
  .tuple(digitsArbitrary, digitsArbitrary, digitsArbitrary)
  .map(([left, middle, right]) => `${left}.${middle}.${right}`);

export function evaluateFormulaAst(ast: FormulaAst, variables: Record<FormulaVariableName, number>): number {
  switch (ast.kind) {
    case "constant":
      return ast.value;
    case "variable":
      return variables[ast.name];
    case "negate":
      return -evaluateFormulaAst(ast.operand, variables);
    case "binary":
      switch (ast.operator) {
        case "+":
          return evaluateFormulaAst(ast.left, variables) + evaluateFormulaAst(ast.right, variables);
        case "-":
          return evaluateFormulaAst(ast.left, variables) - evaluateFormulaAst(ast.right, variables);
        case "*":
          return evaluateFormulaAst(ast.left, variables) * evaluateFormulaAst(ast.right, variables);
      }
  }
}

export function renderFormulaTokens(ast: FormulaAst): string[] {
  switch (ast.kind) {
    case "constant":
      return [String(ast.value)];
    case "variable":
      return [ast.name];
    case "negate":
      return ["-", "(", ...renderFormulaTokens(ast.operand), ")"];
    case "binary":
      return ["(", ...renderFormulaTokens(ast.left), ast.operator, ...renderFormulaTokens(ast.right), ")"];
  }
}

export function renderFormulaWithWhitespace(tokens: string[], whitespaceForIndex: (index: number) => string): string {
  let expression = whitespaceForIndex(-1);
  for (const [index, token] of tokens.entries()) {
    expression += token;
    expression += whitespaceForIndex(index);
  }
  return expression;
}
