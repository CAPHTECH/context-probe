import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainModelScaffoldResult } from "../src/core/contracts.js";
import { loadDomainModel } from "../src/core/model.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { AFS_GOOD_ENTRY, SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY } from "./scaffold.helpers.js";

export function registerScaffoldModelTests(tempRoots: string[]): void {
  test("model.scaffold returns loadable YAML with aggregate candidates", async () => {
    const workspace = await createTemporaryWorkspace([AFS_GOOD_ENTRY]);
    tempRoots.push(workspace);

    const repo = path.join(workspace, AFS_GOOD_ENTRY, "repo");
    const docs = path.join(workspace, AFS_GOOD_ENTRY, "docs");
    const response = await COMMANDS["model.scaffold"]!(
      {
        repo,
        "docs-root": docs,
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("ok");
    const result = response.result as DomainModelScaffoldResult;
    expect(result.model.contexts.map((context) => context.name)).toEqual(["Billing", "Fulfillment"]);
    expect(result.model.aggregates?.map((aggregate) => aggregate.name)).toEqual([
      "BillingAggregate",
      "FulfillmentAggregate",
    ]);

    const modelPath = path.join(workspace, "scaffolded-model.yaml");
    await writeFile(modelPath, result.yaml, "utf8");
    const loaded = await loadDomainModel(modelPath);
    expect(loaded.aggregates?.map((aggregate) => aggregate.name)).toEqual(["BillingAggregate", "FulfillmentAggregate"]);
  });

  test("model.scaffold keeps generic role contexts merged and filters noisy aggregates in fixture repos", async () => {
    const workspace = await createTemporaryWorkspace([SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY]);
    tempRoots.push(workspace);

    const repo = path.join(workspace, SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY, "repo");
    const docs = path.join(workspace, SCAFFOLD_GENERIC_ROLE_SPLIT_ENTRY, "docs");
    const response = await COMMANDS["model.scaffold"]!(
      {
        repo,
        "docs-root": docs,
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    const result = response.result as DomainModelScaffoldResult;
    expect(result.model.contexts.map((context) => context.name)).toEqual([
      "EvaluationAndQuality",
      "IngestAndExtraction",
      "RuntimeAndSurfaces",
      "WorkspaceAndBootstrap",
      "Contracts",
      "KnowledgeSubstrate",
      "QueryAndPlanning",
    ]);
    const aggregateNames = (result.model.aggregates ?? []).map((aggregate) => aggregate.name);
    expect(aggregateNames).not.toContain("APPPORT");
    expect(aggregateNames).not.toContain("MODIFIED");
    expect(aggregateNames).not.toContain("PnpmIngestDiff");
  });

  test("model.scaffold merges docs-aligned context groups across heterogeneous source segments", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    await Promise.all([
      mkdir(path.join(workspace, "repo/src/runtime"), { recursive: true }),
      mkdir(path.join(workspace, "repo/src/surfaces"), { recursive: true }),
      mkdir(path.join(workspace, "docs"), { recursive: true }),
    ]);

    await Promise.all([
      writeFile(
        path.join(workspace, "repo/src/runtime/heartbeat.ts"),
        "export interface RuntimeHeartbeat { lagMs: number; }\n",
        "utf8",
      ),
      writeFile(
        path.join(workspace, "repo/src/surfaces/http.ts"),
        "export interface SurfaceAPI { endpoint: string; }\n",
        "utf8",
      ),
      writeFile(
        path.join(workspace, "docs/domain-model.md"),
        [
          "# Runtime and Surfaces context",
          "",
          "- `RuntimeHeartbeat` records runtime liveness for the Runtime and Surfaces context.",
          "- `SurfaceAPI` exposes the public surface for the Runtime and Surfaces context.",
          "",
        ].join("\n"),
        "utf8",
      ),
    ]);

    const response = await COMMANDS["model.scaffold"]!(
      {
        repo: path.join(workspace, "repo"),
        "docs-root": path.join(workspace, "docs"),
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    const result = response.result as DomainModelScaffoldResult;
    expect(result.model.contexts.map((context) => context.name)).toEqual(["RuntimeAndSurfaces"]);
    expect(result.model.contexts[0]?.pathGlobs).toEqual(["src/runtime/**", "src/surfaces/**"]);
  });

  test("model.scaffold ignores appendix-style docs headings for context naming", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    await Promise.all([
      mkdir(path.join(workspace, "repo/src"), { recursive: true }),
      mkdir(path.join(workspace, "docs"), { recursive: true }),
    ]);

    await Promise.all([
      writeFile(
        path.join(workspace, "repo/src/index.ts"),
        "export interface ServerContext { requestId: string; }\n",
        "utf8",
      ),
      writeFile(
        path.join(workspace, "docs/architecture.md"),
        [
          "## Appendix: Component Diagram (Mermaid)",
          "",
          "- `ServerContext` is referenced by the appendix diagram only.",
          "",
        ].join("\n"),
        "utf8",
      ),
    ]);

    const response = await COMMANDS["model.scaffold"]!(
      {
        repo: path.join(workspace, "repo"),
        "docs-root": path.join(workspace, "docs"),
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    const result = response.result as DomainModelScaffoldResult;
    expect(result.model.contexts.map((context) => context.name)).toEqual(["Application"]);
  });
}
