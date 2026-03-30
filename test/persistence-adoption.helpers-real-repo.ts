import { loadDomainModel } from "../src/core/model.js";
import {
  evaluateShadowRolloutGate,
  loadShadowRolloutRegistry,
  registryToGateObservations,
} from "../src/core/shadow-rollout.js";

import {
  ASSAY_KIT_MANIFEST_PATH,
  PCE_MEMORY_MANIFEST_PATH,
  PROJECT_LOGICA_MANIFEST_PATH,
  REAL_REPO_REGISTRY_PATH,
  SIM_PRISM_MANIFEST_PATH,
  ZAKKI_MANIFEST_PATH,
} from "./persistence-adoption.helpers-constants.js";
import type { RealRepoManifestModels, RealRepoReplacementGate } from "./persistence-adoption.helpers-types.js";

export async function loadRealRepoObservations() {
  const registry = await loadShadowRolloutRegistry(REAL_REPO_REGISTRY_PATH);
  return registryToGateObservations(registry, REAL_REPO_REGISTRY_PATH);
}

export function evaluateRealRepoReplacementGate(
  observations: Awaited<ReturnType<typeof loadRealRepoObservations>>,
): RealRepoReplacementGate {
  return evaluateShadowRolloutGate(observations);
}

export async function loadRealRepoManifestModels(): Promise<RealRepoManifestModels> {
  const [simPrismModel, pceMemoryModel, zakkiModel, assayKitModel, projectLogicaModel] = await Promise.all([
    loadDomainModel(SIM_PRISM_MANIFEST_PATH),
    loadDomainModel(PCE_MEMORY_MANIFEST_PATH),
    loadDomainModel(ZAKKI_MANIFEST_PATH),
    loadDomainModel(ASSAY_KIT_MANIFEST_PATH),
    loadDomainModel(PROJECT_LOGICA_MANIFEST_PATH),
  ]);
  return { simPrismModel, pceMemoryModel, zakkiModel, assayKitModel, projectLogicaModel };
}
