import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import YAML from "yaml";

import { REFRESH_SCRIPT_PATH, SELF_MEASUREMENT_NOW } from "./self-measurement.shared.js";

const execFile = promisify(execFileCallback);

export async function runSelfMeasurementRefresh(repoPath: string): Promise<{ stdout: string; stderr: string }> {
  return execFile(process.execPath, [REFRESH_SCRIPT_PATH, "--repo-root", repoPath, "--now", SELF_MEASUREMENT_NOW], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONTEXT_PROBE_SELF_MEASUREMENT_S003_COMMAND: "true",
    },
  });
}

export async function readYaml<T>(filePath: string): Promise<T> {
  return YAML.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeYaml(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, YAML.stringify(value), "utf8");
}
