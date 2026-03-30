import { COMMANDS } from "../src/commands.js";
import type { ComparisonEnvelope } from "./persistence-adoption.helpers.js";
import { ELS_MODEL_PATH, POLICY_PATH } from "./persistence-adoption.helpers.js";

export async function compareLocality(repoPath: string, modelPath = ELS_MODEL_PATH): Promise<ComparisonEnvelope> {
  const response = await COMMANDS["history.compare_locality_models"]!(
    {
      repo: repoPath,
      model: modelPath,
      policy: POLICY_PATH,
    },
    { cwd: process.cwd() },
  );

  return {
    result: response.result as ComparisonEnvelope["result"],
    confidence: response.confidence,
    unknowns: response.unknowns,
  };
}
