import {
  asNumber,
  asScenarioDirection,
  asString,
  isRecord,
  normalizeScenarioPriority,
  toVersion,
  withOptionalObject,
  withOptionalString,
} from "./command-input-loaders-architecture-compat-shared.js";
import type { ArchitectureScenarioCatalog, ScenarioObservationSet } from "./core/contracts.js";

function sanitizeScenarioCatalogEntries(input: unknown): ArchitectureScenarioCatalog["scenarios"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const scenarioId = asString(entry.scenarioId) ?? asString(entry.id);
    if (!scenarioId) {
      return [];
    }
    const expectations = Array.isArray(entry.quality_expectations) ? entry.quality_expectations.filter(isRecord) : [];
    const firstExpectation = expectations[0];
    const responseMeasure = isRecord(entry.responseMeasure)
      ? {
          ...withOptionalString("metric", asString(entry.responseMeasure.metric)),
          ...withOptionalString("unit", asString(entry.responseMeasure.unit)),
        }
      : undefined;
    const sanitizedResponseMeasure =
      responseMeasure && Object.keys(responseMeasure).length > 0 ? responseMeasure : undefined;
    return [
      {
        scenarioId,
        direction: asScenarioDirection(entry.direction) ?? "higher_is_better",
        priority: normalizeScenarioPriority(entry.priority),
        target: asNumber(entry.target) ?? 1,
        worstAcceptable: asNumber(entry.worstAcceptable) ?? 0,
        ...withOptionalString("name", asString(entry.name)),
        ...withOptionalString(
          "qualityAttribute",
          asString(entry.qualityAttribute) ?? asString(firstExpectation?.attribute),
        ),
        ...withOptionalString(
          "stimulus",
          asString(entry.stimulus) ??
            (isRecord(entry.entry_surface) ? asString(entry.entry_surface.trigger) : undefined),
        ),
        ...withOptionalString(
          "environment",
          asString(entry.environment) ??
            (isRecord(entry.entry_surface) ? asString(entry.entry_surface.user_surface) : undefined),
        ),
        ...withOptionalString("response", asString(entry.response) ?? asString(firstExpectation?.expectation)),
        ...withOptionalObject("responseMeasure", sanitizedResponseMeasure),
      },
    ];
  });
}

function sanitizeScenarioObservations(input: unknown): ScenarioObservationSet["observations"] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const scenarioId = asString(entry.scenarioId) ?? asString(entry.id);
    const observed = asNumber(entry.observed);
    if (!scenarioId || observed === undefined) {
      return [];
    }
    return [
      {
        scenarioId,
        observed,
        ...withOptionalString("source", asString(entry.source)),
        ...withOptionalString("note", asString(entry.note)),
      },
    ];
  });
}

export function normalizeArchitectureScenarioCatalog(input: unknown): ArchitectureScenarioCatalog {
  if (!isRecord(input)) {
    return { version: "1.0", scenarios: [] };
  }
  return {
    version: toVersion(input),
    scenarios: sanitizeScenarioCatalogEntries(input.scenarios),
  };
}

export function normalizeArchitectureScenarioObservations(input: unknown): ScenarioObservationSet {
  if (!isRecord(input)) {
    return { version: "1.0", observations: [] };
  }
  if (Array.isArray(input.observations)) {
    return {
      version: toVersion(input),
      observations: sanitizeScenarioObservations(input.observations),
    };
  }

  const observationsSource =
    (isRecord(input.benchmarkSummary) && Array.isArray(input.benchmarkSummary.observations)
      ? input.benchmarkSummary.observations
      : undefined) ??
    (isRecord(input.incidentReviewSummary) && Array.isArray(input.incidentReviewSummary.observations)
      ? input.incidentReviewSummary.observations
      : undefined);

  return {
    version: toVersion(input),
    observations: sanitizeScenarioObservations(observationsSource),
  };
}
