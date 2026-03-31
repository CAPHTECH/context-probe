import { spawn } from "node:child_process";

import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ScenarioObservationSet,
} from "../core/contracts.js";
import { type ResolvedCanonicalSource, resolveFromBase } from "./architecture-source-loader-shared.js";

async function runCommand(command: string, cwd: string, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: string | Buffer) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: string | Buffer) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      reject(new Error(`${label} command source failed to start: ${error.message}`));
    });
    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} command source was terminated by signal ${signal}.`));
        return;
      }
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(`${label} command source exited with code ${code}.${stderr ? ` stderr: ${stderr}` : ""}`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });
  });
}

export async function resolveCommandSourceConfig<T>(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
  label: string;
}): Promise<ResolvedCanonicalSource<T>> {
  const baseDir = input.configPath.slice(0, input.configPath.lastIndexOf("/")) || ".";
  if (!input.config.command) {
    throw new Error(`${input.label} source config requires 'command' when sourceType=command.`);
  }
  const resolvedCwd = input.config.cwd ? resolveFromBase(baseDir, input.config.cwd) : baseDir;
  const stdout = await runCommand(input.config.command, resolvedCwd, input.label);
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`${input.label} command source returned empty stdout.`);
  }
  let data: T;
  try {
    data = JSON.parse(trimmed) as T;
  } catch (error) {
    throw new Error(
      `${input.label} command source must return JSON on stdout: ${
        error instanceof Error ? error.message : "parse error"
      }`,
    );
  }
  return {
    data,
    configPath: input.configPath,
    sourceType: "command",
    command: input.config.command,
    cwd: resolvedCwd,
    ...(input.config.note ? { note: input.config.note } : {}),
    confidence: 0.8,
    unknowns: [],
    findings: [
      {
        kind: "source_command_loaded",
        confidence: 0.8,
        note: `Loaded canonical input from the command source in ${input.label} source config.`,
        sourceType: "command",
        command: input.config.command,
        cwd: resolvedCwd,
      },
    ],
  };
}

export type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ScenarioObservationSet,
};
