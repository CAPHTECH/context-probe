import type { CommandArgs } from "./command-path-helpers.js";
import type {
  ArchitectureConstraints,
  CommandContext,
  DomainDesignShadowRolloutBatchSpec,
  DomainDesignShadowRolloutRegistry,
  DomainModel,
  ReviewResolutionLog,
} from "./core/contracts.js";
import { readDataFile } from "./core/io.js";
import { loadArchitectureConstraints, loadDomainModel } from "./core/model.js";
import type { loadShadowRolloutRegistry } from "./core/shadow-rollout.js";

function resolveOptionalPathArg(args: CommandArgs, key: string, context: CommandContext): string | undefined {
  return typeof args[key] === "string" ? new URL(args[key], `file://${context.cwd}/`).pathname : undefined;
}

async function loadOptionalDataFile<T>(
  args: CommandArgs,
  key: string,
  context: CommandContext,
): Promise<T | undefined> {
  const filePath = resolveOptionalPathArg(args, key, context);
  if (!filePath) {
    return undefined;
  }
  return readDataFile<T>(filePath);
}

async function loadOptionalConfigFile<T>(
  args: CommandArgs,
  key: string,
  context: CommandContext,
): Promise<{ config: T; configPath: string } | undefined> {
  const configPath = resolveOptionalPathArg(args, key, context);
  if (!configPath) {
    return undefined;
  }
  const config = await readDataFile<T>(configPath);
  return { config, configPath };
}

export async function requireDomainModel(args: CommandArgs, context: CommandContext): Promise<DomainModel> {
  const modelPath = resolveOptionalPathArg(args, "model", context);
  if (!modelPath) {
    throw new Error("`--model` is required");
  }
  return loadDomainModel(modelPath);
}

export async function requireArchitectureConstraints(
  args: CommandArgs,
  context: CommandContext,
): Promise<ArchitectureConstraints> {
  const constraintsPath = resolveOptionalPathArg(args, "constraints", context);
  if (!constraintsPath) {
    throw new Error("`--constraints` is required");
  }
  return loadArchitectureConstraints(constraintsPath);
}

export async function requireShadowRolloutBatchSpec(
  args: CommandArgs,
  context: CommandContext,
): Promise<{ spec: DomainDesignShadowRolloutBatchSpec; specPath: string }> {
  const specPath = resolveOptionalPathArg(args, "batch-spec", context);
  if (!specPath) {
    throw new Error("`--batch-spec` is required");
  }
  const spec = await readDataFile<DomainDesignShadowRolloutBatchSpec>(specPath);
  if (!Array.isArray(spec.entries) || spec.entries.length === 0) {
    throw new Error("Shadow rollout batch spec must contain at least one entry");
  }
  return { spec, specPath };
}

export async function requireShadowRolloutRegistry(
  args: CommandArgs,
  context: CommandContext,
  loadRegistry: typeof loadShadowRolloutRegistry,
): Promise<{ registry: DomainDesignShadowRolloutRegistry; registryPath: string }> {
  const registryPath =
    resolveOptionalPathArg(args, "shadow-rollout-registry", context) ??
    resolveOptionalPathArg(args, "registry", context);
  if (!registryPath) {
    throw new Error("`--shadow-rollout-registry` or `--registry` is required unless `--batch-spec` is provided");
  }
  const registry = await loadRegistry(registryPath);
  return { registry, registryPath };
}

export function loadReviewLogIfRequested(args: CommandArgs, context: CommandContext) {
  return loadOptionalDataFile<ReviewResolutionLog>(args, "review-log", context);
}

export { loadOptionalConfigFile, loadOptionalDataFile };
