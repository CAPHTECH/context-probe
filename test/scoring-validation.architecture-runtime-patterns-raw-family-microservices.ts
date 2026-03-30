import { expect, test } from "vitest";
import { compareRawFamilyPatternRuntime } from "./scoring-validation.architecture-runtime-patterns-raw-family-shared.js";
import {
  OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternRawFamilyMicroservicesScoringValidationTests(): void {
  test("OAS derives PatternRuntime from raw microservices runtime observations", async () => {
    const result = await compareRawFamilyPatternRuntime({
      goodRuntimePath: OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
      badRuntimePath: OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
    });

    expect(result.goodPatternRuntime).toBeGreaterThan(result.badPatternRuntime);
  });
}
