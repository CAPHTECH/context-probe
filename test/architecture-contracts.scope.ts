import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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

  test("named explicit contract layers take precedence over broad api-like layer globs", async () => {
    const root = await createMixedWorkspace();

    try {
      const constraints = {
        version: "1.0",
        direction: "inward" as const,
        layers: [
          { name: "contracts", rank: 0, globs: ["src/lib/contracts/**"] },
          { name: "application", rank: 1, globs: ["src/app/api/**"] },
        ],
      };

      await mkdir(path.join(root, "src/lib/contracts"), { recursive: true });
      await mkdir(path.join(root, "src/app/api/orders"), { recursive: true });
      await writeFile(
        path.join(root, "src/lib/contracts/order.ts"),
        "export interface OrderContract { id: string; }\n",
        "utf8",
      );
      await writeFile(
        path.join(root, "src/app/api/orders/route.ts"),
        "export async function GET() { return Response.json({ ok: true }); }\n",
        "utf8",
      );

      const codebase = await parseCodebase(root);
      const contractPaths = collectContractFilePaths({
        codebase,
        constraints,
      });

      expect(contractPaths).toContain("src/lib/contracts/order.ts");
      expect(contractPaths).not.toContain("src/app/api/orders/route.ts");
      expect(contractPaths.filter((entry) => entry.startsWith("src/app/api/"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
