import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { ArchitectureConstraintsScaffoldResult } from "../src/core/contracts.js";
import { loadArchitectureConstraints } from "../src/core/model.js";
import { createTemporaryWorkspace } from "./helpers.js";

export function registerScaffoldConstraintsTests(tempRoots: string[]): void {
  test("constraints.scaffold returns loadable YAML", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    const response = await COMMANDS["constraints.scaffold"]!(
      {
        repo: path.resolve("fixtures/architecture/sample-repo"),
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    const result = response.result as ArchitectureConstraintsScaffoldResult;
    expect(result.constraints.layers.map((layer) => layer.name)).toEqual(["Domain", "Infrastructure"]);

    const constraintsPath = path.join(workspace, "scaffolded-constraints.yaml");
    await writeFile(constraintsPath, result.yaml, "utf8");
    const loaded = await loadArchitectureConstraints(constraintsPath);
    expect(loaded.layers.map((layer) => layer.name)).toEqual(["Domain", "Infrastructure"]);
  });
}
