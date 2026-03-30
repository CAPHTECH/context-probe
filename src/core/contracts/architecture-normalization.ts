import type { ScenarioDirection } from "./architecture-scenarios.js";

export interface TelemetryNormalizationRule {
  direction: ScenarioDirection;
  target: number;
  worstAcceptable: number;
}
