export type ScenarioDirection = "lower_is_better" | "higher_is_better";

export interface ArchitectureScenario {
  scenarioId: string;
  name?: string;
  qualityAttribute?: string;
  stimulus?: string;
  environment?: string;
  response?: string;
  responseMeasure?: {
    metric?: string;
    unit?: string;
  };
  direction: ScenarioDirection;
  priority: number;
  target: number;
  worstAcceptable: number;
}

export interface ArchitectureScenarioCatalog {
  version: string;
  scenarios: ArchitectureScenario[];
}

export interface ArchitectureScenarioObservationTemplateEntry {
  scenarioId: string;
  name?: string;
  qualityAttribute?: string;
  priority: number;
  measurementStatus: "needs_measurement";
  note: string;
}

export interface ArchitectureScenarioObservationTemplate {
  version: string;
  scenarios: ArchitectureScenarioObservationTemplateEntry[];
}

export interface ScenarioObservation {
  scenarioId: string;
  observed: number;
  source?: string;
  note?: string;
}

export interface ScenarioObservationSet {
  version: string;
  observations: ScenarioObservation[];
}

export interface ArchitectureScenarioQualitySummary {
  totalScenarios: number;
  observedScenarios: number;
  missingObservationScenarioIds: string[];
  missingTopPriorityObservationIds: string[];
  duplicateScenarioIds: string[];
  findings: string[];
}

export type ArchitectureSourceType = "file" | "command";

export interface ArchitectureCanonicalSourceConfig {
  version: string;
  sourceType: ArchitectureSourceType;
  path?: string;
  command?: string;
  cwd?: string;
  note?: string;
}

export interface ArchitectureScenarioObservationSourceConfig extends ArchitectureCanonicalSourceConfig {}
