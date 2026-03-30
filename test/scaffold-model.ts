import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainModelScaffoldResult } from "../src/core/contracts.js";
import { loadDomainModel } from "../src/core/model.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { AFS_GOOD_ENTRY } from "./scaffold.helpers.js";

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
}
