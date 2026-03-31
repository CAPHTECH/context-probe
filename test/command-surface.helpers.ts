import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { CommandContext } from "../src/core/contracts.js";

const REPO_ROOT = process.cwd();
export const CONTEXT: CommandContext = { cwd: REPO_ROOT };
export const DOMAIN_MODEL_PATH = path.resolve("config/self-measurement/domain-model.yaml");
export const ARCHITECTURE_CONSTRAINTS_PATH = path.resolve("config/self-measurement/architecture-constraints.yaml");

export async function withTemporaryDirectory<T>(prefix: string, callback: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
