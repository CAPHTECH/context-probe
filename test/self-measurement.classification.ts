import path from "node:path";

import { expect, test } from "vitest";
import { parseCodebase } from "../src/analyzers/code.js";
import { classifyArchitectureLayer, collectContractFilePaths } from "../src/analyzers/contract-files.js";
import { loadArchitectureConstraints } from "../src/core/model.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { CONSTRAINTS_ENTRY, PROJECT_ENTRIES } from "./self-measurement.shared.js";

export function registerSelfMeasurementClassificationTests(state: { repoPath?: string }): void {
  test("self-measurement architecture constraints classify all src files and isolate the explicit contract layer", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const constraints = await loadArchitectureConstraints(path.join(repoPath, CONSTRAINTS_ENTRY));
    const codebase = await parseCodebase(repoPath);
    const unclassifiedSrc = codebase.scorableSourceFiles
      .filter((filePath) => filePath.startsWith("src/") && !classifyArchitectureLayer(filePath, constraints))
      .sort();
    const contractPaths = collectContractFilePaths({
      codebase,
      constraints,
      allowDartDomainFallback: true,
    }).sort();

    expect(unclassifiedSrc).toEqual([]);
    expect(contractPaths).toEqual(
      expect.arrayContaining([
        "src/core/contracts.ts",
        "src/core/contracts/analysis.ts",
        "src/core/contracts/architecture.ts",
        "src/core/contracts/common.ts",
        "src/core/contracts/domain-design.ts",
        "src/core/contracts/domain-model.ts",
        "src/core/contracts/governance.ts",
      ]),
    );
  });
}
