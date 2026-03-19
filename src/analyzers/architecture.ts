import type { ArchitectureConstraints, CodebaseAnalysis } from "../core/contracts.js";
import { matchGlobs } from "../core/io.js";

export interface DirectionViolation {
  source: string;
  target: string;
  sourceLayer: string;
  targetLayer: string;
}

export interface DependencyDirectionScore {
  IDR: number;
  LRC: number;
  APM: number;
  applicableEdges: number;
  violations: DirectionViolation[];
}

function classifyLayer(filePath: string, constraints: ArchitectureConstraints) {
  return constraints.layers.find((layer) => matchGlobs(filePath, layer.globs));
}

export function detectDirectionViolations(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints
): DirectionViolation[] {
  const violations: DirectionViolation[] = [];
  for (const dependency of codebase.dependencies.filter((entry) => entry.targetKind === "file")) {
    const sourceLayer = classifyLayer(dependency.source, constraints);
    const targetLayer = classifyLayer(dependency.target, constraints);
    if (!sourceLayer || !targetLayer) {
      continue;
    }
    if (sourceLayer.rank < targetLayer.rank) {
      violations.push({
        source: dependency.source,
        target: dependency.target,
        sourceLayer: sourceLayer.name,
        targetLayer: targetLayer.name
      });
    }
  }
  return violations;
}

export function scoreDependencyDirection(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints
): DependencyDirectionScore {
  const classifiedEdges = codebase.dependencies.filter((entry) => {
    if (entry.targetKind !== "file") {
      return false;
    }
    return Boolean(classifyLayer(entry.source, constraints) && classifyLayer(entry.target, constraints));
  });
  const violations = detectDirectionViolations(codebase, constraints);
  const applicableEdges = classifiedEdges.length;
  const illegalRatio = applicableEdges === 0 ? 0 : violations.length / applicableEdges;
  const classifiedCoverage =
    codebase.dependencies.length === 0 ? 0 : Math.min(1, applicableEdges / codebase.dependencies.length);

  return {
    IDR: illegalRatio,
    LRC: 1 - illegalRatio,
    APM: classifiedCoverage,
    applicableEdges,
    violations
  };
}
