import { detectDirectionViolations, scoreDependencyDirection } from "../analyzers/architecture.js";
import { scoreInterfaceProtocolStability } from "../analyzers/architecture-contracts.js";
import { scoreBoundaryPurity } from "../analyzers/architecture-purity.js";
import { scoreQualityScenarioFit } from "../analyzers/architecture-scenarios.js";
import { scoreTopologyIsolation } from "../analyzers/architecture-topology.js";
import type {
  ArchitecturePolicy,
  ArchitectureViolations,
  ComputeArchitectureScoresOptions,
  DirectionScore,
  ProtocolScore,
  PurityScore,
  ScenarioScore,
  TopologyScore,
} from "./architecture-scoring-types.js";
import type { CodebaseAnalysis } from "./contracts.js";
import { evaluateFormula } from "./formula.js";

export interface ArchitectureScoringStaticResults {
  directionScore: DirectionScore;
  purityScore: PurityScore;
  protocolScore: ProtocolScore;
  scenarioScore: ScenarioScore;
  topologyScore: TopologyScore;
  topologyValue: number;
  violations: ArchitectureViolations;
}

export async function resolveArchitectureScoringStaticInputs(
  options: ComputeArchitectureScoresOptions,
  policy: ArchitecturePolicy,
  codebase: CodebaseAnalysis,
): Promise<ArchitectureScoringStaticResults> {
  const directionScore = scoreDependencyDirection(codebase, options.constraints);
  const purityScore = scoreBoundaryPurity(codebase, options.constraints);
  const resolvedContractBaseline = options.contractBaseline ?? options.contractBaselineSource?.data;
  const protocolScore = await scoreInterfaceProtocolStability({
    root: options.repoPath,
    codebase,
    constraints: options.constraints,
    ...(resolvedContractBaseline ? { baseline: resolvedContractBaseline } : {}),
  });

  const scenarioObservationsInput = options.scenarioObservations ?? options.scenarioObservationSource?.data;
  const scenarioScore = scoreQualityScenarioFit({
    ...(options.scenarioCatalog ? { catalog: options.scenarioCatalog } : {}),
    ...(scenarioObservationsInput ? { observations: scenarioObservationsInput } : {}),
  });

  const topologyScore = scoreTopologyIsolation({
    ...(options.topologyModel ? { topology: options.topologyModel } : {}),
    ...(options.runtimeObservations ? { observations: options.runtimeObservations } : {}),
  });
  const topologyValue = policy.metrics.TIS
    ? evaluateFormula(policy.metrics.TIS.formula, {
        FI: topologyScore.FI,
        RC: topologyScore.RC,
        SDR: topologyScore.SDR,
      })
    : 0.4 * topologyScore.FI + 0.3 * topologyScore.RC + 0.3 * (1 - topologyScore.SDR);

  return {
    directionScore,
    purityScore,
    protocolScore,
    scenarioScore,
    topologyScore,
    topologyValue,
    violations: detectDirectionViolations(codebase, options.constraints),
  };
}
