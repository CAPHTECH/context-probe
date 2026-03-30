import { rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { Evidence } from "../src/core/contracts.js";

import { createMixedWorkspace, getMetric, POLICY_PATH } from "./architecture-contracts.helpers.js";

export function registerArchitectureContractCommandTests(): void {
  test("score.compute keeps architecture evidence scoped to constrained layers", async () => {
    const root = await createMixedWorkspace();
    const constraintsPath = `${root}/constraints.yaml`;

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
}
