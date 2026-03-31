import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { ArchitectureConstraintsScaffoldResult, DomainModelScaffoldResult } from "../src/core/contracts.js";

export function registerScaffoldArchitectureGenericTests(tempRoots: string[]): void {
  test("constraints.scaffold splits broad infrastructure buckets using generic file-role heuristics", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "context-probe-scaffold-"));
    tempRoots.push(workspace);

    await Promise.all([
      mkdir(path.join(workspace, "src/contracts"), { recursive: true }),
      mkdir(path.join(workspace, "src/domain"), { recursive: true }),
      mkdir(path.join(workspace, "src/usecases"), { recursive: true }),
      mkdir(path.join(workspace, "src/adapters"), { recursive: true }),
      mkdir(path.join(workspace, "src/project"), { recursive: true }),
      mkdir(path.join(workspace, "src/evaluation"), { recursive: true }),
      mkdir(path.join(workspace, "src/server"), { recursive: true }),
      mkdir(path.join(workspace, "src/mcp"), { recursive: true }),
    ]);

    await Promise.all([
      writeFile(path.join(workspace, "src/contracts/api.ts"), "export interface ApiContract { id: string; }\n", "utf8"),
      writeFile(path.join(workspace, "src/domain/fact.ts"), "export const fact = true;\n", "utf8"),
      writeFile(path.join(workspace, "src/usecases/plan.ts"), "export function plan(): void {}\n", "utf8"),
      writeFile(
        path.join(workspace, "src/adapters/ingest-runtime-delivery.ts"),
        "export function ingest(): void {}\n",
        "utf8",
      ),
      writeFile(path.join(workspace, "src/adapters/duckdb.ts"), "export function connect(): void {}\n", "utf8"),
      writeFile(path.join(workspace, "src/project/workspace.ts"), "export const workspace = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/evaluation/review.ts"), "export const review = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/server/index.ts"), "export const server = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/server/env.ts"), "export const env = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/mcp/server.ts"), "export const mcp = {};\n", "utf8"),
    ]);

    const response = await COMMANDS["constraints.scaffold"]!({ repo: workspace }, { cwd: process.cwd() });
    const result = response.result as ArchitectureConstraintsScaffoldResult;
    const layers = result.constraints.layers;

    expect(layers.map((layer) => layer.name)).toEqual([
      "Contracts",
      "Domain",
      "UseCases",
      "IngestAndExtraction",
      "RuntimeInfrastructure",
      "WorkspaceBootstrap",
      "EvaluationQuality",
    ]);
    expect(layers.find((layer) => layer.name === "IngestAndExtraction")?.globs).toEqual([
      "src/adapters/ingest-runtime-delivery.ts",
    ]);
    expect(layers.find((layer) => layer.name === "RuntimeInfrastructure")?.globs).toEqual([
      "src/adapters/duckdb.ts",
      "src/mcp/server.ts",
      "src/server/index.ts",
    ]);
    expect(layers.find((layer) => layer.name === "WorkspaceBootstrap")?.globs).toEqual([
      "src/project/workspace.ts",
      "src/server/env.ts",
    ]);
  });

  test("model.scaffold re-merges heuristic runtime and workspace contexts across directories", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "context-probe-scaffold-model-"));
    tempRoots.push(workspace);

    await Promise.all([
      mkdir(path.join(workspace, "src/adapters"), { recursive: true }),
      mkdir(path.join(workspace, "src/project"), { recursive: true }),
      mkdir(path.join(workspace, "src/server"), { recursive: true }),
      mkdir(path.join(workspace, "src/mcp"), { recursive: true }),
    ]);

    await Promise.all([
      writeFile(path.join(workspace, "src/adapters/duckdb.ts"), "export function connect(): void {}\n", "utf8"),
      writeFile(path.join(workspace, "src/project/workspace.ts"), "export const workspace = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/server/env.ts"), "export const env = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/server/index.ts"), "export const server = {};\n", "utf8"),
      writeFile(path.join(workspace, "src/mcp/server.ts"), "export const mcp = {};\n", "utf8"),
    ]);

    const response = await COMMANDS["model.scaffold"]!({ repo: workspace }, { cwd: process.cwd() });
    const result = response.result as DomainModelScaffoldResult;
    const contexts = result.model.contexts;

    expect(contexts.map((context) => context.name)).toEqual(["RuntimeInfrastructure", "WorkspaceBootstrap"]);
    expect(contexts.find((context) => context.name === "RuntimeInfrastructure")?.pathGlobs).toEqual([
      "src/adapters/duckdb.ts",
      "src/mcp/server.ts",
      "src/server/index.ts",
    ]);
    expect(contexts.find((context) => context.name === "WorkspaceBootstrap")?.pathGlobs).toEqual([
      "src/project/workspace.ts",
      "src/server/env.ts",
    ]);
  });
}
