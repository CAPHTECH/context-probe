import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ArchitectureConstraints, CommandResponse, MetricScore } from "../src/core/contracts.js";

export const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");

export const ARCHITECTURE_CONSTRAINTS: ArchitectureConstraints = {
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

export async function createMixedWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "context-probe-architecture-contracts-"));

  await mkdir(path.join(root, "src/contracts"), { recursive: true });
  await mkdir(path.join(root, "src/application"), { recursive: true });
  await mkdir(path.join(root, "src/analyzers"), { recursive: true });
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
    path.join(root, "src/analyzers/architecture-contracts.ts"),
    'export function architectureContracts(): string {\n  return "not-a-contract-surface";\n}\n',
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

export function getMetric(response: CommandResponse<unknown>, metricId: string): MetricScore {
  const result = response.result as { metrics: MetricScore[] };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`metric ${metricId} not found`);
  }
  return metric;
}
