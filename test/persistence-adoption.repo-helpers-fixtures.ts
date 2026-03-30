import { writeFile } from "node:fs/promises";
import path from "node:path";

import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { ELS_BASE_ENTRY } from "./persistence-adoption.helpers.js";

export async function materializeGitFixture(tempRoots: string[], initialCommitMessage: string): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([ELS_BASE_ENTRY]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, ELS_BASE_ENTRY);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

export async function buildThreeContextRepo(
  tempRoots: string[],
  initialCommitMessage: string,
): Promise<{ repoPath: string; modelPath: string }> {
  const repoPath = await materializeGitFixture(tempRoots, initialCommitMessage);
  const modelPath = path.join(repoPath, "three-context-model.yaml");
  await writeFile(
    modelPath,
    [
      'version: "1.0"',
      "contexts:",
      "  - name: Billing",
      "    pathGlobs:",
      '      - "src/billing/**"',
      "  - name: Fulfillment",
      "    pathGlobs:",
      '      - "src/fulfillment/**"',
      "  - name: Support",
      "    pathGlobs:",
      '      - "src/support/**"',
    ].join("\n"),
    "utf8",
  );
  return { repoPath, modelPath };
}
