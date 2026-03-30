import { rm } from "node:fs/promises";

import { expect, test } from "vitest";

import { parseCodebase } from "../src/analyzers/code.js";
import { collectContractFilePaths } from "../src/analyzers/contract-files.js";

import { ARCHITECTURE_CONSTRAINTS, createMixedWorkspace } from "./architecture-contracts.helpers.js";

export function registerArchitectureContractScopeTests(): void {
  test("collectContractFilePaths ignores contract-like files outside constrained layers", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const contractPaths = collectContractFilePaths({
        codebase,
        constraints: ARCHITECTURE_CONSTRAINTS,
      });

      expect(contractPaths).toEqual(["src/contracts/order-contract.ts"]);
      expect(contractPaths.some((entry) => entry.includes("fixtures/"))).toBe(false);
      expect(contractPaths).not.toContain("src/analyzers/architecture-contracts.ts");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("IPS ignores fixture-style contracts that are outside the measured architecture scope", async () => {
    const root = await createMixedWorkspace();

    try {
      const codebase = await parseCodebase(root);
      const { scoreInterfaceProtocolStability } = await import("../src/analyzers/architecture-contracts.js");
      const protocol = await scoreInterfaceProtocolStability({
        root,
        codebase,
        constraints: ARCHITECTURE_CONSTRAINTS,
      });

      expect(protocol.findings.some((finding) => finding.path.includes("fixtures/"))).toBe(false);
      expect(protocol.CBC).toBe(1);
      expect(protocol.BCR).toBe(0);
      expect(protocol.SLA).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
