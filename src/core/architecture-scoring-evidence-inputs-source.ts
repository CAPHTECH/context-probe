import type { EvidenceEntry } from "./architecture-scoring-evidence-inputs-shared.js";
import { buildSourceConfigEvidence } from "./architecture-scoring-evidence-inputs-shared.js";
import type { ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";

export function buildContractBaselineSourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.contractBaselineSource, "contract_baseline_source");
}

export function buildScenarioSourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.scenarioObservationSource, "scenario_observation_source");
}

export function buildTelemetrySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.telemetrySource, "telemetry_source");
}

export function buildDeliverySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.deliverySource, "delivery_source");
}

export function buildComplexitySourceEvidence(options: ComputeArchitectureScoresOptions): EvidenceEntry[] {
  return buildSourceConfigEvidence(options.complexitySource, "complexity_source");
}
