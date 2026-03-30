import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  OAS_GOOD_TELEMETRY_PATH,
  OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
  POLICY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export async function compareRawFamilyPatternRuntime(options: {
  goodRuntimePath: string;
  badRuntimePath: string;
}): Promise<{ goodPatternRuntime: number; badPatternRuntime: number }> {
  const goodResponse = await COMMANDS["score.compute"]!(
    {
      repo: TIS_REPO,
      constraints: TIS_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
      "pattern-runtime-raw-observations": options.goodRuntimePath,
      "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
    },
    { cwd: process.cwd() },
  );
  const badResponse = await COMMANDS["score.compute"]!(
    {
      repo: TIS_REPO,
      constraints: TIS_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
      "pattern-runtime-raw-observations": options.badRuntimePath,
      "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH,
    },
    { cwd: process.cwd() },
  );

  return {
    goodPatternRuntime: getMetric(goodResponse, "OAS").components.PatternRuntime ?? 0,
    badPatternRuntime: getMetric(badResponse, "OAS").components.PatternRuntime ?? 0,
  };
}
