import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";
import YAML from "yaml";

import { COMMANDS } from "../src/commands.js";
import type { ArchitectureConstraintsScaffoldResult } from "../src/core/contracts.js";
import { loadArchitectureConstraints } from "../src/core/model.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY } from "./scaffold.helpers.js";

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

  test("constraints.scaffold keeps semantic role layers merged in fixture repos", async () => {
    const workspace = await createTemporaryWorkspace([SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY]);
    tempRoots.push(workspace);

    const repo = path.join(workspace, SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY, "repo");
    const response = await COMMANDS["constraints.scaffold"]!(
      {
        repo,
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    const result = response.result as ArchitectureConstraintsScaffoldResult;
    expect(result.constraints.layers.map((layer) => layer.name)).toEqual([
      "Contracts",
      "Domain",
      "UseCases",
      "IngestAndExtraction",
      "RuntimeInfrastructure",
      "WorkspaceBootstrap",
      "EvaluationQuality",
    ]);
  });

  test("constraints.scaffold includes generic helper drafts for architecture inputs", async () => {
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
    expect(result.drafts).toBeDefined();
    expect(result.drafts?.boundaryMap.value.boundaries.map((boundary) => boundary.name)).toEqual([
      "Domain",
      "Infrastructure",
    ]);
    expect(result.drafts?.boundaryMap.value.boundaries.map((boundary) => boundary.pathGlobs)).toEqual([
      ["src/domain/**"],
      ["src/infrastructure/**"],
    ]);

    const scenarioCatalog = YAML.parse(result.drafts?.scenarioCatalog.yaml ?? "") as {
      scenarios?: Array<{ name?: string; qualityAttribute?: string }>;
    };
    expect(scenarioCatalog.scenarios?.map((scenario) => scenario.name)).toEqual([
      "Domain locality",
      "Infrastructure locality",
    ]);
    expect(scenarioCatalog.scenarios?.every((scenario) => scenario.qualityAttribute === "Architecture locality")).toBe(
      true,
    );

    const topologyModel = YAML.parse(result.drafts?.topologyModel.yaml ?? "") as {
      nodes?: Array<{ nodeId?: string; kind?: string }>;
      edges?: Array<{ source?: string; target?: string }>;
    };
    expect(topologyModel.nodes?.map((node) => node.nodeId)).toEqual(["domain", "infrastructure"]);
    expect(topologyModel.edges).toEqual([
      {
        source: "domain",
        target: "infrastructure",
        kind: "sync_call",
      },
    ]);
    expect(topologyModel.nodes?.map((node) => node.kind)).toEqual(["service", "service"]);
  });
}
