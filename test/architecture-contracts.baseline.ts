import { mkdir, rm, writeFile } from "node:fs/promises";

import { expect, test } from "vitest";

import {
  captureInterfaceProtocolBaseline,
  scoreInterfaceProtocolStability,
} from "../src/analyzers/architecture-contracts.js";
import { parseCodebase } from "../src/analyzers/code.js";

import { ARCHITECTURE_CONSTRAINTS, createMixedWorkspace } from "./architecture-contracts.helpers.js";

export function registerArchitectureContractBaselineTests(): void {
  test("captureInterfaceProtocolBaseline emits the current contract surface in canonical form", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const baseline = await captureInterfaceProtocolBaseline({
        root,
        codebase,
        constraints: ARCHITECTURE_CONSTRAINTS,
        capturedAt: "2026-03-30T00:00:00Z",
      });

      expect(baseline.snapshot).toEqual({
        sourceKind: "captured",
        capturedAt: "2026-03-30T00:00:00Z",
      });
      expect(baseline.contracts).toEqual([
        {
          path: "src/contracts/order-contract.ts",
          symbols: [
            {
              name: "OrderContract",
              kind: "interface",
              stability: "stable",
              looseness: "strict",
            },
          ],
          imports: {
            total: 0,
            nonContract: 0,
            internal: 0,
          },
        },
      ]);
    } finally {
      await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
    }
  });

  test("IPS uses a baseline snapshot to remove the CBC/BCR proxy unknown", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const baseline = await captureInterfaceProtocolBaseline({
        root,
        codebase,
        constraints: ARCHITECTURE_CONSTRAINTS,
      });

      await mkdir(`${root}/src/infrastructure`, { recursive: true });
      await writeFile(
        `${root}/src/contracts/order-contract.ts`,
        'import { logger } from "../infrastructure/logger";\n\nexport class OrderContract {\n  constructor(public payload: any) {}\n}\n',
        "utf8",
      );
      await writeFile(
        `${root}/src/infrastructure/logger.ts`,
        "export function logger(value: unknown): void {\n  void value;\n}\n",
        "utf8",
      );

      const changedCodebase = await parseCodebase(root);
      const protocol = await scoreInterfaceProtocolStability({
        root,
        codebase: changedCodebase,
        constraints: ARCHITECTURE_CONSTRAINTS,
        baseline,
      });

      expect(protocol.unknowns).not.toContain(
        "CBC/BCR are current-state contract-stability proxies, not baseline deltas.",
      );
      expect(protocol.CBC).toBeLessThan(1);
      expect(protocol.BCR).toBeGreaterThan(0);
      expect(protocol.findings.some((finding) => finding.note.includes("regressed OrderContract"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
