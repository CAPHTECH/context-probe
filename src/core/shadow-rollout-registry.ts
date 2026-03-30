import path from "node:path";

import type {
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutGateObservation,
  DomainDesignShadowRolloutRegistry,
} from "./contracts.js";
import { readDataFile } from "./io.js";

export function inferShadowRolloutModelSource(modelPath: string): "repo_owned" | "versioned_manifest" {
  return modelPath.includes(`${path.sep}fixtures${path.sep}validation${path.sep}shadow-rollout${path.sep}`)
    ? "versioned_manifest"
    : "repo_owned";
}

export async function loadShadowRolloutRegistry(registryPath: string): Promise<DomainDesignShadowRolloutRegistry> {
  return readDataFile<DomainDesignShadowRolloutRegistry>(registryPath);
}

export function registryToGateObservations(
  registry: DomainDesignShadowRolloutRegistry,
  registryPath: string,
): DomainDesignShadowRolloutGateObservation[] {
  const registryDirectory = path.dirname(registryPath);
  return registry.repos.map((entry) => ({
    repoId: entry.repoId,
    category: entry.category,
    modelSource: entry.modelSource,
    ...(entry.manifestPath ? { modelPath: path.resolve(registryDirectory, entry.manifestPath) } : {}),
    relevantCommitCount: entry.observation.relevantCommitCount,
    delta: entry.observation.delta,
  }));
}

export function batchToGateObservations(
  observations: DomainDesignShadowRolloutBatchObservation[],
): DomainDesignShadowRolloutGateObservation[] {
  return observations.map((entry) => ({
    repoId: entry.repoId,
    category: entry.category,
    modelSource: entry.modelSource,
    modelPath: entry.modelPath,
    relevantCommitCount: entry.relevantCommitCount,
    delta: entry.policyDelta,
  }));
}
