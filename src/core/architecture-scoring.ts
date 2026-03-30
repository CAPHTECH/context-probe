import { buildArchitectureEvidence, collectArchitectureEvidence } from "./architecture-scoring-evidence.js";
import { resolveArchitectureEvolutionInputs } from "./architecture-scoring-evolution-inputs.js";
import { resolveArchitectureScoringInputs } from "./architecture-scoring-inputs.js";
import { buildArchitectureMetricScores } from "./architecture-scoring-metrics.js";
import type {
  ArchitectureScoringContext,
  ArchitectureViolations,
  ComputeArchitectureScoresOptions,
} from "./architecture-scoring-types.js";
import type { CommandResponse, MetricScore } from "./contracts.js";
import { getDomainPolicy } from "./policy.js";
import { confidenceFromSignals, createResponse, toProvenance } from "./response.js";

export async function computeArchitectureScores(options: ComputeArchitectureScoresOptions): Promise<
  CommandResponse<{
    domainId: "architecture_design";
    metrics: MetricScore[];
    violations: ArchitectureViolations;
  }>
> {
  const { repoPath, policyConfig, profileName } = options;
  const policy = getDomainPolicy(policyConfig, profileName, "architecture_design");
  const inputResults = await resolveArchitectureScoringInputs(options, policy);
  const evolutionResults = await resolveArchitectureEvolutionInputs(
    options,
    policy,
    inputResults.deliveryNormalizationResult,
  );
  const context: ArchitectureScoringContext = {
    directionScore: inputResults.directionScore,
    purityScore: inputResults.purityScore,
    protocolScore: inputResults.protocolScore,
    scenarioScore: inputResults.scenarioScore,
    topologyScore: inputResults.topologyScore,
    ...(inputResults.telemetryExportIngestResult
      ? { telemetryExportIngestResult: inputResults.telemetryExportIngestResult }
      : {}),
    ...(inputResults.patternRuntimeNormalizationResult
      ? { patternRuntimeNormalizationResult: inputResults.patternRuntimeNormalizationResult }
      : {}),
    ...(inputResults.telemetryNormalizationResult
      ? { telemetryNormalizationResult: inputResults.telemetryNormalizationResult }
      : {}),
    operationsScore: inputResults.operationsScore,
    ...(inputResults.deliveryExportIngestResult
      ? { deliveryExportIngestResult: inputResults.deliveryExportIngestResult }
      : {}),
    ...(inputResults.deliveryNormalizationResult
      ? { deliveryNormalizationResult: inputResults.deliveryNormalizationResult }
      : {}),
    ...(inputResults.complexityExportIngestResult
      ? { complexityExportIngestResult: inputResults.complexityExportIngestResult }
      : {}),
    complexityScore: inputResults.complexityScore,
    architectureCommits: evolutionResults.architectureCommits,
    architectureHistoryDiagnostics: evolutionResults.architectureHistoryDiagnostics,
    evolutionLocalityScore: evolutionResults.evolutionLocalityScore,
    evolutionEfficiencyScore: evolutionResults.evolutionEfficiencyScore,
    localityValue: evolutionResults.localityValue,
    violations: inputResults.violations,
    usablePatternRuntimeRaw: inputResults.usablePatternRuntimeRaw,
  };
  const architectureEvidence = buildArchitectureEvidence(options, context);
  const scores = buildArchitectureMetricScores(options, policy, context, architectureEvidence);
  const evidence = collectArchitectureEvidence(architectureEvidence);

  return createResponse(
    {
      domainId: "architecture_design",
      metrics: scores,
      violations: inputResults.violations,
    },
    {
      status: evolutionResults.architectureHistoryDiagnostics.length > 0 ? "warning" : "ok",
      evidence,
      confidence: confidenceFromSignals(scores.map((score) => score.confidence)),
      unknowns: Array.from(new Set(scores.flatMap((score) => score.unknowns))),
      diagnostics: evolutionResults.architectureHistoryDiagnostics,
      provenance: [
        toProvenance(repoPath, "architecture_design"),
        toProvenance(repoPath, `profile=${profileName}`),
        ...(options.additionalProvenance ?? []),
      ],
    },
  );
}
