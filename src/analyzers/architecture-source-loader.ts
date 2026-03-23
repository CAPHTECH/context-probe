import { exec as execCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureComplexitySourceConfig,
  ArchitectureDeliveryExportBundle,
  ArchitectureDeliverySourceConfig,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetrySourceConfig,
  ScenarioObservationSet
} from "../core/contracts.js";
import { readDataFile } from "../core/io.js";

const exec = promisify(execCallback);

export interface SourceResolutionFinding {
  kind: "source_file_loaded" | "source_command_loaded";
  confidence: number;
  note: string;
  sourceType: "file" | "command";
  sourcePath?: string;
  command?: string;
  cwd?: string;
}

export interface ResolvedCanonicalSource<T> {
  data: T;
  configPath: string;
  sourceType: "file" | "command";
  resolvedPath?: string;
  command?: string;
  cwd?: string;
  note?: string;
  confidence: number;
  unknowns: string[];
  findings: SourceResolutionFinding[];
}

function resolveFromBase(baseDir: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}

async function resolveSourceConfig<T>(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
  label: string;
}): Promise<ResolvedCanonicalSource<T>> {
  const baseDir = path.dirname(input.configPath);
  const { config } = input;

  if (config.sourceType === "file") {
    if (!config.path) {
      throw new Error(`${input.label} source config requires 'path' when sourceType=file.`);
    }
    const resolvedPath = resolveFromBase(baseDir, config.path);
    const data = await readDataFile<T>(resolvedPath);
    return {
      data,
      configPath: input.configPath,
      sourceType: "file",
      resolvedPath,
      ...(config.note ? { note: config.note } : {}),
      confidence: 0.86,
      unknowns: [],
      findings: [
        {
          kind: "source_file_loaded",
          confidence: 0.86,
          note: `Loaded canonical input from the file source in ${input.label} source config.`,
          sourceType: "file",
          sourcePath: resolvedPath
        }
      ]
    };
  }

  if (config.sourceType === "command") {
    if (!config.command) {
      throw new Error(`${input.label} source config requires 'command' when sourceType=command.`);
    }
    const resolvedCwd = config.cwd ? resolveFromBase(baseDir, config.cwd) : baseDir;
    const { stdout } = await exec(config.command, {
      cwd: resolvedCwd,
      maxBuffer: 10 * 1024 * 1024
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
        }`
      );
    }
    return {
      data,
      configPath: input.configPath,
      sourceType: "command",
      command: config.command,
      cwd: resolvedCwd,
      ...(config.note ? { note: config.note } : {}),
      confidence: 0.8,
      unknowns: [],
      findings: [
        {
          kind: "source_command_loaded",
          confidence: 0.8,
          note: `Loaded canonical input from the command source in ${input.label} source config.`,
          sourceType: "command",
          command: config.command,
          cwd: resolvedCwd
        }
      ]
    };
  }

  throw new Error(`${input.label} sourceType=${String(config.sourceType)} is not supported.`);
}

export async function resolveTelemetrySourceConfig(input: {
  config: ArchitectureTelemetrySourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureTelemetryExportBundle>> {
  return resolveSourceConfig<ArchitectureTelemetryExportBundle>({
    ...input,
    label: "telemetry"
  });
}

export async function resolveDeliverySourceConfig(input: {
  config: ArchitectureDeliverySourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>> {
  return resolveSourceConfig<ArchitectureDeliveryExportBundle>({
    ...input,
    label: "delivery"
  });
}

export async function resolveComplexitySourceConfig(input: {
  config: ArchitectureComplexitySourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureComplexityExportBundle>> {
  return resolveSourceConfig<ArchitectureComplexityExportBundle>({
    ...input,
    label: "complexity"
  });
}

export async function resolveScenarioObservationSourceConfig(input: {
  config: ArchitectureScenarioObservationSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ScenarioObservationSet>> {
  return resolveSourceConfig<ScenarioObservationSet>({
    ...input,
    label: "scenario observation"
  });
}
