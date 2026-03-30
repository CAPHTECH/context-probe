import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

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

const exec = promisify(execCallback);

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
  const { stdout } = await exec(input.config.command, {
    cwd: resolvedCwd,
    maxBuffer: 10 * 1024 * 1024,
  });
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
