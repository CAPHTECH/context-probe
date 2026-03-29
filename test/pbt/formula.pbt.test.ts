import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { evaluateFormula } from "../../src/core/formula.js";
import {
  evaluateFormulaAst,
  formulaAstArbitrary,
  formulaVariablesArbitrary,
  invalidNumericLiteralArbitrary,
  renderFormulaTokens,
  renderFormulaWithWhitespace,
  whitespaceFunctionArbitrary,
} from "./generators/formula.js";

const PROPERTY_SEED = 20260329;
const PROPERTY_RUNS = 100;

describe("formula property tests", () => {
  test("matches the reference AST evaluator for generated formulas", () => {
    fc.assert(
      fc.property(formulaAstArbitrary, formulaVariablesArbitrary, (ast, variables) => {
        const expression = renderFormulaTokens(ast).join("");
        const expected = evaluateFormulaAst(ast, variables);
        expect(evaluateFormula(expression, variables)).toBe(expected);
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED },
    );
  });

  test("ignores arbitrary whitespace between generated tokens", () => {
    fc.assert(
      fc.property(
        formulaAstArbitrary,
        formulaVariablesArbitrary,
        whitespaceFunctionArbitrary,
        (ast, variables, gap) => {
          const tokens = renderFormulaTokens(ast);
          const compactExpression = tokens.join("");
          const spacedExpression = renderFormulaWithWhitespace(tokens, gap);
          expect(evaluateFormula(spacedExpression, variables)).toBe(evaluateFormula(compactExpression, variables));
        },
      ),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED + 1 },
    );
  });

  test("rejects malformed decimal literals instead of returning NaN", () => {
    fc.assert(
      fc.property(invalidNumericLiteralArbitrary, (expression) => {
        expect(() => evaluateFormula(expression, {})).toThrow("Invalid numeric literal");
      }),
      { numRuns: PROPERTY_RUNS, seed: PROPERTY_SEED + 2 },
    );
  });
});
