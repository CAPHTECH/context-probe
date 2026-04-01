import type {
  ArchitectureScenarioCatalog,
  ArchitectureScenarioQualitySummary,
  ScenarioObservationSet,
} from "./contracts.js";

function normalizeScenarioIntent(name: string | undefined, metric: string | undefined): string {
  return `${name ?? ""}::${metric ?? ""}`.trim().toLowerCase();
}

export function summarizeArchitectureScenarioQuality(input: {
  catalog?: ArchitectureScenarioCatalog;
  observations?: ScenarioObservationSet;
}): ArchitectureScenarioQualitySummary | undefined {
  const catalog = input.catalog;
  if (!catalog || catalog.scenarios.length === 0) {
    return undefined;
  }

  const observationIds = new Set((input.observations?.observations ?? []).map((entry) => entry.scenarioId));
  const missingObservationScenarioIds: string[] = [];
  const missingTopPriorityObservationIds: string[] = [];
  const duplicateScenarioIds = new Set<string>();
  const findings: string[] = [];
  const intentToScenarioIds = new Map<string, string[]>();

  for (const scenario of catalog.scenarios) {
    const intentKey = normalizeScenarioIntent(scenario.name, scenario.responseMeasure?.metric);
    if (intentKey) {
      const current = intentToScenarioIds.get(intentKey) ?? [];
      current.push(scenario.scenarioId);
      intentToScenarioIds.set(intentKey, current);
    }
    if (!observationIds.has(scenario.scenarioId)) {
      missingObservationScenarioIds.push(scenario.scenarioId);
      if (scenario.priority >= 4) {
        missingTopPriorityObservationIds.push(scenario.scenarioId);
      }
    }
  }

  for (const [intentKey, scenarioIds] of intentToScenarioIds.entries()) {
    if (scenarioIds.length <= 1) {
      continue;
    }
    scenarioIds.forEach((scenarioId) => {
      duplicateScenarioIds.add(scenarioId);
    });
    findings.push(
      `Scenario intent ${intentKey || "unnamed"} is duplicated across ${scenarioIds.join(", ")} and should be tightened.`,
    );
  }

  if (missingTopPriorityObservationIds.length > 0) {
    findings.push(`Top-priority scenarios are missing observations: ${missingTopPriorityObservationIds.join(", ")}.`);
  } else if (missingObservationScenarioIds.length > 0) {
    findings.push(`Scenario observations are still missing for ${missingObservationScenarioIds.join(", ")}.`);
  }

  return {
    totalScenarios: catalog.scenarios.length,
    observedScenarios: catalog.scenarios.length - missingObservationScenarioIds.length,
    missingObservationScenarioIds,
    missingTopPriorityObservationIds,
    duplicateScenarioIds: Array.from(duplicateScenarioIds),
    findings,
  };
}
