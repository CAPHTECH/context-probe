import path from "node:path";

import type {
  BoundaryLeakFinding,
  CodebaseAnalysis,
  ContractUsageReport,
  DomainModel,
  FileDependency,
} from "../core/contracts.js";
import { matchGlobs } from "../core/io.js";

export function getScorableDependencies(codebase: CodebaseAnalysis): FileDependency[] {
  const scorableSources = new Set(codebase.scorableSourceFiles);
  return codebase.dependencies.filter((dependency) => scorableSources.has(dependency.source));
}

function classifyContext(
  filePath: string,
  model: DomainModel,
): { context?: string; classification: "contract" | "internal" | "unclassified" } {
  for (const context of model.contexts) {
    if (!matchGlobs(filePath, context.pathGlobs)) {
      continue;
    }
    if (matchGlobs(filePath, context.contractGlobs)) {
      return { context: context.name, classification: "contract" };
    }
    if (matchGlobs(filePath, context.internalGlobs)) {
      return { context: context.name, classification: "internal" };
    }
    return { context: context.name, classification: "unclassified" };
  }
  return { classification: "unclassified" };
}

export function detectContractUsage(codebase: CodebaseAnalysis, model: DomainModel): ContractUsageReport {
  let applicableReferences = 0;
  let compliantReferences = 0;
  const findings: ContractUsageReport["findings"] = [];

  for (const dependency of getScorableDependencies(codebase).filter((entry) => entry.targetKind === "file")) {
    const sourceInfo = classifyContext(dependency.source, model);
    const targetInfo = classifyContext(dependency.target, model);
    if (!sourceInfo.context || !targetInfo.context || sourceInfo.context === targetInfo.context) {
      continue;
    }
    applicableReferences += 1;
    if (targetInfo.classification === "contract") {
      compliantReferences += 1;
    }
    findings.push({
      source: dependency.source,
      target: dependency.target,
      sourceContext: sourceInfo.context,
      targetContext: targetInfo.context,
      targetClassification: targetInfo.classification,
    });
  }

  return {
    adherence: applicableReferences === 0 ? 1 : compliantReferences / applicableReferences,
    applicableReferences,
    compliantReferences,
    findings,
  };
}

export function detectBoundaryLeaks(codebase: CodebaseAnalysis, model: DomainModel): BoundaryLeakFinding[] {
  const findings: BoundaryLeakFinding[] = [];

  for (const dependency of getScorableDependencies(codebase).filter((entry) => entry.targetKind === "file")) {
    const sourceInfo = classifyContext(dependency.source, model);
    const targetInfo = classifyContext(dependency.target, model);
    if (!sourceInfo.context || !targetInfo.context || sourceInfo.context === targetInfo.context) {
      continue;
    }
    if (targetInfo.classification !== "internal") {
      continue;
    }
    findings.push({
      findingId: `BL-${dependency.source.replace(/[^A-Za-z0-9]/g, "").slice(-8)}-${findings.length + 1}`,
      severity: "high",
      sourceContext: sourceInfo.context,
      targetContext: targetInfo.context,
      violationType: "direct_internal_type_reference",
      sourceSymbol: path.basename(dependency.source),
      targetSymbol: path.basename(dependency.target),
      path: dependency.source,
    });
  }

  return findings;
}
