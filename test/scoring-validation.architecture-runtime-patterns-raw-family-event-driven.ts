import { expect, test } from "vitest";
import { compareRawFamilyPatternRuntime } from "./scoring-validation.architecture-runtime-patterns-raw-family-shared.js";
import {
  OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
  OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimePatternRawFamilyEventDrivenScoringValidationTests(): void {
  test("OAS derives PatternRuntime from raw event-driven runtime observations", async () => {
    const result = await compareRawFamilyPatternRuntime({
      goodRuntimePath: OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
      badRuntimePath: OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
    });

    expect(result.goodPatternRuntime).toBeGreaterThan(result.badPatternRuntime);
  });
}
