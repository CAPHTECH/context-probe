import { describe, expect, test } from "vitest";

import { evaluateFormula } from "../src/core/formula.js";

describe("evaluateFormula", () => {
  test("evaluates arithmetic formulas with identifiers", () => {
    const value = evaluateFormula("0.50*MRP + 0.25*(1-BLR) + 0.25*CLA", {
      MRP: 0.75,
      BLR: 0.25,
      CLA: 0.5,
    });

    expect(value).toBeCloseTo(0.6875, 5);
  });

  test("rejects malformed numeric literals", () => {
    expect(() => evaluateFormula("1..2", {})).toThrow("Invalid numeric literal");
    expect(() => evaluateFormula("1.2.3 + 4", {})).toThrow("Invalid numeric literal");
  });

  test("rejects non-finite results", () => {
    expect(() => evaluateFormula("1 / 0", {})).toThrow("non-finite result");
  });
});
