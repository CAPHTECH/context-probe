import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  type ArchitectureConstraintsScaffoldResult,
  type DomainModelScaffoldResult
} from "../src/core/contracts.js";
import { loadArchitectureConstraints, loadDomainModel } from "../src/core/model.js";
import {
  cleanupTemporaryRepo,
  createTemporaryWorkspace,
  initializeTemporaryGitRepo
} from "./helpers.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";

describe("scaffold commands", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  test("model.scaffold returns loadable YAML with aggregate candidates", async () => {
    const workspace = await createTemporaryWorkspace([AFS_GOOD_ENTRY]);
    tempRoots.push(workspace);

    const repo = path.join(workspace, AFS_GOOD_ENTRY, "repo");
    const docs = path.join(workspace, AFS_GOOD_ENTRY, "docs");
    const response = await COMMANDS["model.scaffold"]!(
      {
        repo,
        "docs-root": docs
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("ok");
    const result = response.result as DomainModelScaffoldResult;
    expect(result.model.contexts.map((context) => context.name)).toEqual(["Billing", "Fulfillment"]);
    expect(result.model.aggregates?.map((aggregate) => aggregate.name)).toEqual([
      "BillingAggregate",
      "FulfillmentAggregate"
    ]);

    const modelPath = path.join(workspace, "scaffolded-model.yaml");
    await writeFile(modelPath, result.yaml, "utf8");
    const loaded = await loadDomainModel(modelPath);
    expect(loaded.aggregates?.map((aggregate) => aggregate.name)).toEqual([
      "BillingAggregate",
      "FulfillmentAggregate"
    ]);
  });

  test("constraints.scaffold returns loadable YAML", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    const response = await COMMANDS["constraints.scaffold"]!(
      {
        repo: path.resolve("fixtures/architecture/sample-repo")
      },
      { cwd: process.cwd() }
    );

    expect(response.status).toBe("warning");
    const result = response.result as ArchitectureConstraintsScaffoldResult;
    expect(result.constraints.layers.map((layer) => layer.name)).toEqual(["Domain", "Infrastructure"]);

    const constraintsPath = path.join(workspace, "scaffolded-constraints.yaml");
    await writeFile(constraintsPath, result.yaml, "utf8");
    const loaded = await loadArchitectureConstraints(constraintsPath);
    expect(loaded.layers.map((layer) => layer.name)).toEqual(["Domain", "Infrastructure"]);
  });

  test("explicit aggregates refine AFS beyond the context proxy", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    const repoRoot = path.join(workspace, "repo");
    const docsRoot = path.join(workspace, "docs");
    await mkdir(path.join(repoRoot, "src/billing/internal"), { recursive: true });
    await mkdir(docsRoot, { recursive: true });

    await writeFile(
      path.join(repoRoot, "src/billing/internal/invoice-aggregate.ts"),
      "export class InvoiceAggregate {\n  total = 0;\n}\n",
      "utf8"
    );
    await writeFile(
      path.join(repoRoot, "src/billing/internal/ledger-aggregate.ts"),
      "export class LedgerAggregate {\n  total = 0;\n}\n",
      "utf8"
    );
    await writeFile(
      path.join(docsRoot, "aggregate.md"),
      [
        "# Billing context",
        "",
        "`Invoice` is a Billing aggregate.",
        "`Ledger` is a Billing aggregate.",
        "Billing context では Invoice と Ledger の残高が常に一致していなければならない。",
        "Invoice と Ledger は同じ transaction で更新されなければならない。"
      ].join("\n"),
      "utf8"
    );

    await initializeTemporaryGitRepo(repoRoot, "feat: init explicit aggregates");

    const proxyModelPath = path.join(workspace, "proxy-model.yaml");
    const explicitModelPath = path.join(workspace, "explicit-model.yaml");
    await writeFile(
      proxyModelPath,
      [
        "version: \"1.0\"",
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        "      - \"src/billing/**\"",
        "    internalGlobs:",
        "      - \"src/billing/internal/**\""
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      explicitModelPath,
      [
        "version: \"1.0\"",
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        "      - \"src/billing/**\"",
        "    internalGlobs:",
        "      - \"src/billing/internal/**\"",
        "aggregates:",
        "  - name: InvoiceAggregate",
        "    context: Billing",
        "    aliases:",
        "      - Invoice",
        "  - name: LedgerAggregate",
        "    context: Billing",
        "    aliases:",
        "      - Ledger"
      ].join("\n"),
      "utf8"
    );

    const proxyResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: proxyModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot
      },
      { cwd: process.cwd() }
    );
    const explicitResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: explicitModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot
      },
      { cwd: process.cwd() }
    );

    const proxyAfs = getMetric(proxyResponse, "AFS");
    const explicitAfs = getMetric(explicitResponse, "AFS");

    expect(explicitAfs.value).toBeLessThan(proxyAfs.value);
    expect(explicitAfs.components.SIC ?? 0).toBeLessThan(proxyAfs.components.SIC ?? 0);
    expect(explicitAfs.components.XTC ?? 0).toBeGreaterThan(proxyAfs.components.XTC ?? 0);
    expect(proxyAfs.unknowns).toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy."
    );
    expect(explicitAfs.unknowns).not.toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy."
    );
  }, 20000);
});

function getMetric(
  response: Awaited<ReturnType<NonNullable<typeof COMMANDS["score.compute"]>>>,
  metricId: string
) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
