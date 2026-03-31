import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureScenarioCatalog,
  ArchitectureScenarioObservationTemplate,
  ArchitectureTopologyModel,
  CodebaseAnalysis,
} from "./contracts.js";
import { buildArchitectureScaffoldDrafts as buildArchitectureScaffoldDraftsImpl } from "./scaffold-architecture-drafts-builders.js";

export interface ArchitectureScaffoldDraft<T> {
  value: T;
  yaml: string;
}

export interface ArchitectureScaffoldDrafts {
  scenarioObservationsTemplate: ArchitectureScaffoldDraft<ArchitectureScenarioObservationTemplate>;
  scenarioCatalog: ArchitectureScaffoldDraft<ArchitectureScenarioCatalog>;
  topologyModel: ArchitectureScaffoldDraft<ArchitectureTopologyModel>;
  boundaryMap: ArchitectureScaffoldDraft<ArchitectureBoundaryMap>;
}

export function buildArchitectureScaffoldDrafts(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints,
): ArchitectureScaffoldDrafts {
  return buildArchitectureScaffoldDraftsImpl(codebase, constraints);
}
