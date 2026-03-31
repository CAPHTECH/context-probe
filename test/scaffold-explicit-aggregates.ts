import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";
import { getMetric, POLICY_PATH } from "./scaffold.helpers.js";

export function registerScaffoldExplicitAggregateTests(tempRoots: string[]): void {
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
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "src/billing/internal/ledger-aggregate.ts"),
      "export class LedgerAggregate {\n  total = 0;\n}\n",
      "utf8",
    );
    await writeFile(
      path.join(docsRoot, "aggregate.md"),
      [
        "# Billing context",
        "",
        "`Invoice` is a Billing aggregate.",
        "`Ledger` is a Billing aggregate.",
        "Billing context では Invoice と Ledger の残高が常に一致していなければならない。",
        "Invoice と Ledger は同じ transaction で更新されなければならない。",
      ].join("\n"),
      "utf8",
    );

    await initializeTemporaryGitRepo(repoRoot, "feat: init explicit aggregates");

    const proxyModelPath = path.join(workspace, "proxy-model.yaml");
    const explicitModelPath = path.join(workspace, "explicit-model.yaml");
    await writeFile(
      proxyModelPath,
      [
        'version: "1.0"',
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        '      - "src/billing/**"',
        "    internalGlobs:",
        '      - "src/billing/internal/**"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      explicitModelPath,
      [
        'version: "1.0"',
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        '      - "src/billing/**"',
        "    internalGlobs:",
        '      - "src/billing/internal/**"',
        "aggregates:",
        "  - name: InvoiceAggregate",
        "    context: Billing",
        "    aliases:",
        "      - Invoice",
        "  - name: LedgerAggregate",
        "    context: Billing",
        "    aliases:",
        "      - Ledger",
      ].join("\n"),
      "utf8",
    );

    const proxyResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: proxyModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot,
      },
      { cwd: process.cwd() },
    );
    const explicitResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: explicitModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot,
      },
      { cwd: process.cwd() },
    );

    const proxyAfs = getMetric(proxyResponse, "AFS");
    const explicitAfs = getMetric(explicitResponse, "AFS");

    expect(explicitAfs.value).toBeLessThan(proxyAfs.value);
    expect(explicitAfs.components.SIC ?? 0).toBeLessThan(proxyAfs.components.SIC ?? 0);
    expect(explicitAfs.components.XTC ?? 0).toBeGreaterThan(proxyAfs.components.XTC ?? 0);
    expect(proxyAfs.unknowns).toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy.",
    );
    expect(explicitAfs.unknowns).not.toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy.",
    );
  }, 20000);

  test("explicit aggregates refine AFS when docs use decomposed aggregate names", async () => {
    const workspace = await createTemporaryWorkspace([]);
    tempRoots.push(workspace);

    const repoRoot = path.join(workspace, "repo");
    const docsRoot = path.join(workspace, "docs");
    await mkdir(path.join(repoRoot, "src/billing/internal"), { recursive: true });
    await mkdir(docsRoot, { recursive: true });

    await writeFile(
      path.join(repoRoot, "src/billing/internal/invoice-aggregate.ts"),
      "export class InvoiceAggregate {\n  total = 0;\n}\n",
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "src/billing/internal/ledger-entry-aggregate.ts"),
      "export class LedgerEntryAggregate {\n  total = 0;\n}\n",
      "utf8",
    );
    await writeFile(
      path.join(docsRoot, "aggregate.md"),
      [
        "# Billing context",
        "",
        "Billing context では invoice total と ledger entry total が常に一致していなければならない。",
        "invoice total と ledger entry total は同じ transaction で更新されなければならない。",
      ].join("\n"),
      "utf8",
    );

    await initializeTemporaryGitRepo(repoRoot, "feat: init decomposed aggregate names");

    const proxyModelPath = path.join(workspace, "proxy-model.yaml");
    const explicitModelPath = path.join(workspace, "explicit-model.yaml");
    await writeFile(
      proxyModelPath,
      [
        'version: "1.0"',
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        '      - "src/billing/**"',
        "    internalGlobs:",
        '      - "src/billing/internal/**"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      explicitModelPath,
      [
        'version: "1.0"',
        "contexts:",
        "  - name: Billing",
        "    pathGlobs:",
        '      - "src/billing/**"',
        "    internalGlobs:",
        '      - "src/billing/internal/**"',
        "aggregates:",
        "  - name: InvoiceAggregate",
        "    context: Billing",
        "  - name: LedgerEntryAggregate",
        "    context: Billing",
      ].join("\n"),
      "utf8",
    );

    const proxyResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: proxyModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot,
      },
      { cwd: process.cwd() },
    );
    const explicitResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoRoot,
        model: explicitModelPath,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": docsRoot,
      },
      { cwd: process.cwd() },
    );

    const proxyAfs = getMetric(proxyResponse, "AFS");
    const explicitAfs = getMetric(explicitResponse, "AFS");

    expect(explicitAfs.value).toBeLessThan(proxyAfs.value);
    expect(explicitAfs.unknowns).not.toContain(
      "No aggregate definitions were found, so context is being used as an aggregate proxy.",
    );
    expect(explicitAfs.unknowns).not.toContain(
      "Some invariants could not be mapped to explicit aggregates, so context proxy was retained.",
    );
  }, 20000);
}
