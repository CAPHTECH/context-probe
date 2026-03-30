import { expect, test } from "vitest";
import { compareRawFamilyPatternRuntime } from "./scoring-validation.architecture-runtime-patterns-raw-family-shared.js";
import {
  OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternRawFamilyCqrsScoringValidationTests(): void {
  test("OAS derives PatternRuntime from raw cqrs runtime observations", async () => {
    const result = await compareRawFamilyPatternRuntime({
      goodRuntimePath: OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
      badRuntimePath: OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
    });

    expect(result.goodPatternRuntime).toBeGreaterThan(result.badPatternRuntime);
  });
}
