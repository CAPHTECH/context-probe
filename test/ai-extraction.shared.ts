import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const CODEX_STUB = path.resolve("test/fixtures/stubs/codex-stub.mjs");
export const CLAUDE_STUB = path.resolve("test/fixtures/stubs/claude-stub.mjs");

export async function prepareAiExtractionStub(stubPath: string): Promise<void> {
  await chmod(stubPath, 0o755);
}

export async function restoreAiExtractionStubs(): Promise<void> {
  await chmod(CODEX_STUB, 0o755);
  await chmod(CLAUDE_STUB, 0o755);
}

export async function writeTempJson(payload: unknown): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-review-"));
  const filePath = path.join(tempDir, "payload.json");
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}
