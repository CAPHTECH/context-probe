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
});
