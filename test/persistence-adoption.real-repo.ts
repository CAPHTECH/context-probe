import { expect, test } from "vitest";

import {
  evaluateRealRepoReplacementGate,
  loadRealRepoManifestModels,
  loadRealRepoObservations,
} from "./persistence-adoption.helpers.js";

export function registerPersistenceAdoptionRealRepoTests() {
  test("loads versioned external-repo shadow rollout manifests", async () => {
    const observations = await loadRealRepoObservations();
    const { simPrismModel, pceMemoryModel, zakkiModel, assayKitModel, projectLogicaModel } =
      await loadRealRepoManifestModels();

    expect(observations.map((entry) => entry.repoId)).toEqual([
      "context-probe",
      "sample_app",
      "sim_prism",
      "pce-memory",
      "zakki",
      "assay-kit",
      "project_logica",
    ]);
    expect(simPrismModel.contexts.map((context) => context.name)).toEqual([
      "CoreRuntime",
      "EnvironmentModeling",
      "BehaviorSystem",
      "AnalyticsAndExperiments",
      "PluginContracts",
      "APIAndBuilders",
    ]);
    expect(pceMemoryModel.contexts.map((context) => context.name)).toEqual([
      "RuntimeInterfaces",
      "DomainState",
      "HandlerPipeline",
      "SyncAndAudit",
      "PersistenceStore",
      "SearchAndEmbeddings",
    ]);
    expect(zakkiModel.contexts.map((context) => context.name)).toEqual([
      "MobileApp",
      "WebsiteApp",
      "WorkerBackend",
      "DataAndSchema",
    ]);
    expect(assayKitModel.contexts.map((context) => context.name)).toEqual([
      "CoreToolkit",
      "McpServer",
      "VerificationKit",
      "FormalSpecs",
    ]);
    expect(projectLogicaModel.contexts.map((context) => context.name)).toEqual([
      "CoreKernel",
      "RuntimeAndCli",
      "Integrations",
      "ServicePlugins",
      "WorkflowAgents",
      "SamplePlugins",
    ]);
  });

  test("keeps replacement in shadow rollout while real-repo drift variance remains high", async () => {
    const summary = evaluateRealRepoReplacementGate(await loadRealRepoObservations());

    expect(summary.repoCount).toBe(7);
    expect(summary.repoOwnedCount).toBe(2);
    expect(summary.versionedManifestCount).toBe(5);
    expect(summary.overall.positiveDeltaCount).toBe(6);
    expect(summary.overall.negativeDeltaCount).toBe(1);
    expect(summary.overall.averageDelta).toBeCloseTo(0.05991094594522802, 12);
    expect(summary.overall.weightedAverageDelta).toBeCloseTo(0.043210609174773186, 12);
    expect(summary.overall.medianDelta).toBeCloseTo(0.04821513002364075, 12);
    expect(summary.overall.minDelta).toBeCloseTo(-0.08938050770826689, 12);
    expect(summary.overall.maxDelta).toBeCloseTo(0.16615362732477523, 12);
    expect(summary.overall.deltaRange).toBeCloseTo(0.2555341350330421, 12);
    expect(summary.reasons).toEqual(["real_repo_delta_range_above_threshold"]);
    expect(summary.replacementVerdict).toBe("no_go");
    expect(summary.rolloutDisposition).toBe("shadow_only");
  });

  test("explains current delta range through application and tooling categories", async () => {
    const summary = evaluateRealRepoReplacementGate(await loadRealRepoObservations());
    const application = summary.categories.find((entry) => entry.category === "application");
    const tooling = summary.categories.find((entry) => entry.category === "tooling");

    expect(summary.categories.map((entry) => entry.category)).toEqual(["application", "tooling"]);
    expect(application).toBeDefined();
    expect(application?.repoIds).toEqual(["sample_app", "sim_prism", "zakki"]);
    expect(application?.summary.repoCount).toBe(3);
    expect(application?.summary.positiveDeltaCount).toBe(2);
    expect(application?.summary.negativeDeltaCount).toBe(1);
    expect(application?.summary.averageDelta).toBeCloseTo(0.00018893966387611982, 12);
    expect(application?.summary.minDelta).toBeCloseTo(-0.08938050770826689, 12);
    expect(application?.summary.maxDelta).toBeCloseTo(0.04821513002364075, 12);
    expect(application?.summary.deltaRange).toBeCloseTo(0.13759563773190764, 12);
    expect(application?.gate.reasons).toEqual([]);
    expect(application?.gate.replacementVerdict).toBe("go");
    expect(application?.gate.rolloutDisposition).toBe("replace");
    expect(tooling).toBeDefined();
    expect(tooling?.repoIds).toEqual(["context-probe", "pce-memory", "assay-kit", "project_logica"]);
    expect(tooling?.summary.repoCount).toBe(4);
    expect(tooling?.summary.positiveDeltaCount).toBe(4);
    expect(tooling?.summary.negativeDeltaCount).toBe(0);
    expect(tooling?.summary.averageDelta).toBeCloseTo(0.10470245065624172, 12);
    expect(tooling?.summary.weightedAverageDelta).toBeCloseTo(0.09927054919652575, 12);
    expect(tooling?.summary.minDelta).toBeCloseTo(0.03618532818532816, 12);
    expect(tooling?.summary.maxDelta).toBeCloseTo(0.16615362732477523, 12);
    expect(tooling?.summary.deltaRange).toBeCloseTo(0.12996829913944707, 12);
    expect(tooling?.gate.reasons).toEqual(["real_repo_weighted_average_delta_above_threshold"]);
    expect(tooling?.gate.replacementVerdict).toBe("no_go");
    expect(tooling?.gate.rolloutDisposition).toBe("shadow_only");
    expect(application?.summary.deltaRange ?? 1).toBeLessThanOrEqual(0.15);
    expect(tooling?.summary.deltaRange ?? 1).toBeLessThanOrEqual(0.15);
    expect(summary.overall.deltaRange).toBeGreaterThan(0.15);
  });
}
