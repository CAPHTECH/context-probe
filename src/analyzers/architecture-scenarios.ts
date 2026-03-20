import type {
  ArchitectureScenarioCatalog,
  ScenarioDirection,
  ScenarioObservationSet
} from "../core/contracts.js";

export interface QualityScenarioFinding {
  scenarioId: string;
  confidence: number;
  normalized?: number;
  observed?: number;
  source: "catalog" | "observation";
  note: string;
}

export interface QualityScenarioFitScore {
  QSF: number;
  scenarioCount: number;
  weightedCoverage: number;
  averageNormalizedScore: number;
  confidence: number;
  unknowns: string[];
  findings: QualityScenarioFinding[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeObservedValue(input: {
  direction: ScenarioDirection;
  observed: number;
  target: number;
  worstAcceptable: number;
}): number {
  const { direction, observed, target, worstAcceptable } = input;
  if (direction === "lower_is_better") {
    return clamp01((worstAcceptable - observed) / Math.max(0.0001, worstAcceptable - target));
  }
  return clamp01((observed - worstAcceptable) / Math.max(0.0001, target - worstAcceptable));
}

export function scoreQualityScenarioFit(input: {
  catalog?: ArchitectureScenarioCatalog;
  observations?: ScenarioObservationSet;
}): QualityScenarioFitScore {
  if (!input.catalog || input.catalog.scenarios.length === 0) {
    return {
      QSF: 0,
      scenarioCount: 0,
      weightedCoverage: 0,
      averageNormalizedScore: 0,
      confidence: 0.2,
      unknowns: ["scenario catalog が指定されていないため QSF は未観測です"],
      findings: []
    };
  }

  const observationById = new Map(
    (input.observations?.observations ?? []).map((observation) => [observation.scenarioId, observation])
  );
  const findings: QualityScenarioFinding[] = [];
  const unknowns: string[] = [];
  const normalizedScores: number[] = [];
  let totalPriority = 0;
  let observedPriority = 0;
  let weightedScore = 0;

  for (const scenario of input.catalog.scenarios) {
    totalPriority += scenario.priority;
    if (scenario.priority <= 0) {
      unknowns.push(`${scenario.scenarioId} の priority が 0 以下で QSF 集計に寄与しません`);
      findings.push({
        scenarioId: scenario.scenarioId,
        confidence: 0.5,
        source: "catalog",
        note: `${scenario.scenarioId} は priority が 0 以下です`
      });
      continue;
    }
    const observation = observationById.get(scenario.scenarioId);
    if (!observation) {
      unknowns.push(`${scenario.scenarioId} の observed value が不足しています`);
      findings.push({
        scenarioId: scenario.scenarioId,
        confidence: 0.45,
        source: "catalog",
        note: `${scenario.scenarioId} は observed value がないため QSF に十分反映できません`
      });
      continue;
    }

    const normalized = normalizeObservedValue({
      direction: scenario.direction,
      observed: observation.observed,
      target: scenario.target,
      worstAcceptable: scenario.worstAcceptable
    });
    observedPriority += scenario.priority;
    weightedScore += scenario.priority * normalized;
    normalizedScores.push(normalized);
    findings.push({
      scenarioId: scenario.scenarioId,
      confidence: 0.88,
      normalized,
      observed: observation.observed,
      source: "observation",
      note: `${scenario.scenarioId} の normalized score は ${normalized.toFixed(3)} です`
    });
  }

  if (!input.observations || input.observations.observations.length === 0) {
    unknowns.push("scenario observations が指定されていないため QSF は保守的な近似です");
  }

  const weightedCoverage = totalPriority === 0 ? 0 : observedPriority / totalPriority;
  const QSF = totalPriority === 0 ? 0 : weightedScore / totalPriority;

  return {
    QSF,
    scenarioCount: input.catalog.scenarios.length,
    weightedCoverage,
    averageNormalizedScore: average(normalizedScores, 0),
    confidence: clamp01(
      average(
        [
          input.catalog.scenarios.length > 0 ? 0.85 : 0.2,
          weightedCoverage > 0 ? 0.82 : 0.35,
          normalizedScores.length > 0 ? 0.88 : 0.3
        ],
        0.4
      )
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings
  };
}
