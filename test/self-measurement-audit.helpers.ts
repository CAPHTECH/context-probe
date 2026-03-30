import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import YAML from "yaml";

const execFile = promisify(execFileCallback);

const AUDIT_SCRIPT_PATH = path.resolve("scripts/self-measurement/audit-architecture-freshness.mjs");
const REFRESH_SCRIPT_PATH = path.resolve("scripts/self-measurement/refresh-architecture-inputs.mjs");
export const PROJECT_ENTRIES = ["src", "config/self-measurement"];

export async function refreshArchitectureSelfMeasurement(repoPath: string): Promise<void> {
  await execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
    },
  });
}

export async function auditArchitectureSelfMeasurement(repoPath: string): Promise<{ stdout: string; stderr: string }> {
  return execFile(process.execPath, [AUDIT_SCRIPT_PATH, "--repo-root", repoPath, "--now", "2026-03-30T00:00:00Z"], {
    cwd: process.cwd(),
  });
}

export async function readYaml<T>(filePath: string): Promise<T> {
  return YAML.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, YAML.stringify(value), "utf8");
}
