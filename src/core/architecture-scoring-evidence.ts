import {
  buildComplexityEvidence,
  buildComplexityExportEvidence,
  buildDeliveryExportEvidence,
  buildDeliveryNormalizationEvidence,
  buildDirectionEvidence,
  buildEvolutionEvidence,
  buildOperationsEvidence,
  buildPatternRuntimeNormalizationEvidence,
  buildProtocolEvidence,
  buildPurityEvidence,
  buildScenarioEvidence,
  buildTelemetryExportEvidence,
  buildTelemetryNormalizationEvidence,
  buildTopologyEvidence,
} from "./architecture-scoring-evidence-findings.js";
import {
  buildComplexitySourceEvidence,
  buildContractBaselineInputEvidence,
  buildContractBaselineSourceEvidence,
  buildDeliveryInputEvidence,
  buildDeliverySourceEvidence,
  buildScenarioSourceEvidence,
  buildTelemetryInputEvidence,
  buildTelemetrySourceEvidence,
} from "./architecture-scoring-evidence-inputs.js";
import type { ArchitectureScoringContext, ComputeArchitectureScoresOptions } from "./architecture-scoring-types.js";
import type { toEvidence } from "./response.js";

type EvidenceEntry = ReturnType<typeof toEvidence>;

export interface ArchitectureEvidenceBundle {
  direction: EvidenceEntry[];
  purity: EvidenceEntry[];
  protocol: EvidenceEntry[];
  contractBaselineSource: EvidenceEntry[];
  contractBaselineInput: EvidenceEntry[];
  scenario: EvidenceEntry[];
  scenarioSource: EvidenceEntry[];
  topology: EvidenceEntry[];
  operations: EvidenceEntry[];
  telemetrySource: EvidenceEntry[];
  telemetryNormalization: EvidenceEntry[];
  patternRuntimeNormalization: EvidenceEntry[];
  telemetryExport: EvidenceEntry[];
  deliverySource: EvidenceEntry[];
  deliveryNormalization: EvidenceEntry[];
  complexitySource: EvidenceEntry[];
  deliveryExport: EvidenceEntry[];
  complexityExport: EvidenceEntry[];
  complexity: EvidenceEntry[];
  evolution: EvidenceEntry[];
  deliveryInput: EvidenceEntry[];
  telemetryInput: EvidenceEntry[];
}

export function buildArchitectureEvidence(
  options: ComputeArchitectureScoresOptions,
  context: ArchitectureScoringContext,
): ArchitectureEvidenceBundle {
  const direction = buildDirectionEvidence(context);
  const purity = buildPurityEvidence(context);
  const protocol = buildProtocolEvidence(context);
  const contractBaselineSource = buildContractBaselineSourceEvidence(options);
  const contractBaselineInput = buildContractBaselineInputEvidence(options);
  const scenario = buildScenarioEvidence(context);
  const scenarioSource = buildScenarioSourceEvidence(options);
  const topology = buildTopologyEvidence(context);
  const operations = buildOperationsEvidence(context);
  const telemetrySource = buildTelemetrySourceEvidence(options);
  const telemetryNormalization = buildTelemetryNormalizationEvidence(context);
  const patternRuntimeNormalization = buildPatternRuntimeNormalizationEvidence(context);
  const telemetryExport = buildTelemetryExportEvidence(context);
  const deliverySource = buildDeliverySourceEvidence(options);
  const deliveryNormalization = buildDeliveryNormalizationEvidence(context);
  const complexitySource = buildComplexitySourceEvidence(options);
  const deliveryExport = buildDeliveryExportEvidence(context);
  const complexityExport = buildComplexityExportEvidence(context);
  const complexity = buildComplexityEvidence(context);
  const evolution = buildEvolutionEvidence(context);
  const deliveryInput = buildDeliveryInputEvidence(options, context);
  const telemetryInput = buildTelemetryInputEvidence(options, context);

  return {
    direction,
    purity,
    protocol,
    contractBaselineSource,
    contractBaselineInput,
    scenario,
    scenarioSource,
    topology,
    operations,
    telemetrySource,
    telemetryNormalization,
    patternRuntimeNormalization,
    telemetryExport,
    deliverySource,
    deliveryNormalization,
    complexitySource,
    deliveryExport,
    complexityExport,
    complexity,
    evolution,
    deliveryInput,
    telemetryInput,
  };
}

export function collectArchitectureEvidence(evidence: ArchitectureEvidenceBundle): EvidenceEntry[] {
  return [
    ...evidence.scenarioSource,
    ...evidence.scenario,
    ...evidence.direction,
    ...evidence.purity,
    ...evidence.contractBaselineInput,
    ...evidence.protocol,
    ...evidence.contractBaselineSource,
    ...evidence.topology,
    ...evidence.telemetrySource,
    ...evidence.telemetryInput,
    ...evidence.telemetryExport,
    ...evidence.telemetryNormalization,
    ...evidence.patternRuntimeNormalization,
    ...evidence.operations,
    ...evidence.deliverySource,
    ...evidence.deliveryInput,
    ...evidence.deliveryExport,
    ...evidence.deliveryNormalization,
    ...evidence.complexitySource,
    ...evidence.complexityExport,
    ...evidence.complexity,
    ...evidence.evolution,
  ];
}
