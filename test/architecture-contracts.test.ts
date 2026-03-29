import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { scoreInterfaceProtocolStability } from "../src/analyzers/architecture-contracts.js";
import { parseCodebase } from "../src/analyzers/code.js";
import { collectContractFilePaths } from "../src/analyzers/contract-files.js";
import { COMMANDS } from "../src/commands.js";
import type { ArchitectureConstraints, CommandResponse, Evidence, MetricScore } from "../src/core/contracts.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");

async function createMixedWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-probe-architecture-contracts-"));

  await mkdir(path.join(root, "src/contracts"), { recursive: true });
  await mkdir(path.join(root, "src/application"), { recursive: true });
  await mkdir(path.join(root, "fixtures/validation/scoring/ips/bad-repo/src/contracts"), {
    recursive: true,
  });
  await mkdir(path.join(root, "fixtures/validation/scoring/ips/bad-repo/src/infrastructure"), {
    recursive: true,
  });

  await writeFile(
    path.join(root, "src/contracts/order-contract.ts"),
    "export interface OrderContract {\n  id: string;\n}\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "src/application/load-order.ts"),
    'import type { OrderContract } from "../contracts/order-contract";\n\nexport function loadOrder(input: OrderContract): OrderContract {\n  return input;\n}\n',
    "utf8",
  );
  await writeFile(
    path.join(root, "fixtures/validation/scoring/ips/bad-repo/src/contracts/order-contract.ts"),
    'import { logger } from "../infrastructure/logger";\n\nexport interface FixtureContract {\n  id: any;\n}\n\nexport function normalizeOrder(input: FixtureContract): FixtureContract {\n  logger(input.id);\n  return input;\n}\n',
    "utf8",
  );
  await writeFile(
    path.join(root, "fixtures/validation/scoring/ips/bad-repo/src/infrastructure/logger.ts"),
    "export function logger(value: unknown): void {\n  void value;\n}\n",
    "utf8",
  );

  return root;
}

function getMetric(response: CommandResponse<unknown>, metricId: string): MetricScore {
  const result = response.result as { metrics: MetricScore[] };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`metric ${metricId} not found`);
  }
  return metric;
}

describe("architecture contract scope", () => {
  const constraints: ArchitectureConstraints = {
    version: "1.0",
    direction: "inward",
    layers: [
      {
        name: "contracts",
        rank: 0,
        globs: ["src/contracts/**"],
      },
      {
        name: "application",
        rank: 1,
        globs: ["src/application/**"],
      },
      {
        name: "infrastructure",
        rank: 2,
        globs: ["src/infrastructure/**"],
      },
    ],
  };

  test("collectContractFilePaths ignores contract-like files outside constrained layers", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const contractPaths = collectContractFilePaths({
        codebase,
        constraints,
      });

      expect(contractPaths).toEqual(["src/contracts/order-contract.ts"]);
      expect(contractPaths.some((entry) => entry.includes("fixtures/"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("IPS ignores fixture-style contracts that are outside the measured architecture scope", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const protocol = await scoreInterfaceProtocolStability({
        root,
        codebase,
        constraints,
      });

      expect(protocol.findings.some((finding) => finding.path.includes("fixtures/"))).toBe(false);
      expect(protocol.CBC).toBe(1);
      expect(protocol.BCR).toBe(0);
      expect(protocol.SLA).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("score.compute keeps architecture evidence scoped to constrained layers", async () => {
    const root = await createMixedWorkspace();
    const constraintsPath = path.join(root, "constraints.yaml");

    try {
      await writeFile(
        constraintsPath,
        [
          'version: "1.0"',
          "direction: inward",
          "layers:",
          "  - name: contracts",
          "    rank: 0",
          "    globs:",
          '      - "src/contracts/**"',
          "  - name: application",
          "    rank: 1",
          "    globs:",
          '      - "src/application/**"',
          "  - name: infrastructure",
          "    rank: 2",
          "    globs:",
          '      - "src/infrastructure/**"',
          "",
        ].join("\n"),
        "utf8",
      );

      const response = await COMMANDS["score.compute"]!(
        {
          repo: root,
          constraints: constraintsPath,
          policy: POLICY_PATH,
          domain: "architecture_design",
        },
        { cwd: process.cwd() },
      );

      expect(response.status).not.toBe("error");
      expect(getMetric(response, "IPS").value).toBeGreaterThan(0.95);
      expect(
        response.evidence.some((entry: Evidence) =>
          entry.statement.includes("fixtures/validation/scoring/ips/bad-repo/src/contracts/order-contract.ts"),
        ),
      ).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
