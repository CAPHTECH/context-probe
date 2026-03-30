import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import type {
  ArchitectureCanonicalSourceConfig,
  ArchitectureComplexityExportBundle,
  ArchitectureContractBaseline,
  ArchitectureDeliveryExportBundle,
  ArchitectureScenarioObservationSourceConfig,
  ArchitectureTelemetryExportBundle,
  ArchitectureTelemetrySourceConfig,
  ScenarioObservationSet,
} from "../core/contracts.js";
import { readDataFile } from "../core/io.js";
import { type ResolvedCanonicalSource, resolveFromBase } from "./architecture-source-loader-shared.js";

const exec = promisify(execCallback);

async function resolveSourceConfig<T>(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
  label: string;
}): Promise<ResolvedCanonicalSource<T>> {
  const baseDir = input.configPath.slice(0, input.configPath.lastIndexOf("/")) || ".";
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
          sourcePath: resolvedPath,
        },
      ],
    };
  }

  if (config.sourceType === "command") {
    if (!config.command) {
      throw new Error(`${input.label} source config requires 'command' when sourceType=command.`);
    }
    const resolvedCwd = config.cwd ? resolveFromBase(baseDir, config.cwd) : baseDir;
    const { stdout } = await exec(config.command, {
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
          cwd: resolvedCwd,
        },
      ],
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
    label: "telemetry",
  });
}

export async function resolveDeliverySourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureDeliveryExportBundle>> {
  return resolveSourceConfig<ArchitectureDeliveryExportBundle>({
    ...input,
    label: "delivery",
  });
}

export async function resolveComplexitySourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureComplexityExportBundle>> {
  return resolveSourceConfig<ArchitectureComplexityExportBundle>({
    ...input,
    label: "complexity",
  });
}

export async function resolveScenarioObservationSourceConfig(input: {
  config: ArchitectureScenarioObservationSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ScenarioObservationSet>> {
  return resolveSourceConfig<ScenarioObservationSet>({
    ...input,
    label: "scenario observation",
  });
}

export async function resolveContractBaselineSourceConfig(input: {
  config: ArchitectureCanonicalSourceConfig;
  configPath: string;
}): Promise<ResolvedCanonicalSource<ArchitectureContractBaseline>> {
  return resolveSourceConfig<ArchitectureContractBaseline>({
    ...input,
    label: "contract baseline",
  });
}
