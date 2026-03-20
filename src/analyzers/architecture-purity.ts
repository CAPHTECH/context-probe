import type { ArchitectureConstraints, CodebaseAnalysis, LayerDefinition } from "../core/contracts.js";
import { classifyArchitectureLayer } from "./contract-files.js";
import { getScorableDependencies } from "./code.js";

export interface PurityFinding {
  kind: "adapter_leak" | "framework_contamination" | "shared_internal_component";
  path: string;
  source?: string;
  target?: string;
  sourceLayer?: string;
  targetLayer?: string;
  confidence: number;
  note: string;
}

export interface BoundaryPurityScore {
  ALR: number;
  FCC: number;
  SICR: number;
  confidence: number;
  unknowns: string[];
  findings: PurityFinding[];
}

const FRAMEWORK_SIGNAL = /(infrastructure|infra|adapter|adapters|framework|frameworks|controller|controllers|gateway|gateways|schema|logger|http|web|ui)/i;
const INTERNAL_SIGNAL = /(internal|infra|infrastructure|adapter|adapters|schema|logger|gateway|gateways)/i;
const SHARED_FRAMEWORK_LAYER_SIGNAL = /(shared|common|platform|core|foundation|theme|ui)/i;

function classifyLayer(filePath: string, constraints: ArchitectureConstraints): LayerDefinition | undefined {
  return classifyArchitectureLayer(filePath, constraints);
}

function isFrameworkish(filePath: string, layerName?: string): boolean {
  return FRAMEWORK_SIGNAL.test(filePath) || (layerName ? FRAMEWORK_SIGNAL.test(layerName) : false);
}

function isInternalish(filePath: string, layerName?: string): boolean {
  return INTERNAL_SIGNAL.test(filePath) || (layerName ? INTERNAL_SIGNAL.test(layerName) : false);
}

function isAllowedFrameworkLayer(layer: LayerDefinition, maxRank: number): boolean {
  return layer.rank === maxRank || isFrameworkish(layer.name) || SHARED_FRAMEWORK_LAYER_SIGNAL.test(layer.name);
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function scoreBoundaryPurity(
  codebase: CodebaseAnalysis,
  constraints: ArchitectureConstraints
): BoundaryPurityScore {
  const unknowns: string[] = [];
  const findings: PurityFinding[] = [];
  const classifiedFiles = codebase.scorableSourceFiles
    .map((filePath) => ({
      path: filePath,
      layer: classifyLayer(filePath, constraints)
    }))
    .filter((entry): entry is { path: string; layer: LayerDefinition } => Boolean(entry.layer));
  const classifiedEdges = getScorableDependencies(codebase)
    .filter((dependency) => dependency.targetKind === "file")
    .map((dependency) => ({
      dependency,
      sourceLayer: classifyLayer(dependency.source, constraints),
      targetLayer: classifyLayer(dependency.target, constraints)
    }))
    .filter(
      (entry): entry is {
        dependency: CodebaseAnalysis["dependencies"][number];
        sourceLayer: LayerDefinition;
        targetLayer: LayerDefinition;
      } => Boolean(entry.sourceLayer && entry.targetLayer)
    );
  const maxRank = constraints.layers.reduce((current, layer) => Math.max(current, layer.rank), 0);

  const adapterCandidates = classifiedEdges.filter(({ dependency, targetLayer }) =>
    isFrameworkish(dependency.target, targetLayer.name)
  );
  const adapterLeaks = adapterCandidates.filter(({ sourceLayer, targetLayer }) => sourceLayer.rank < targetLayer.rank);
  const ALR = adapterCandidates.length === 0 ? 0 : adapterLeaks.length / adapterCandidates.length;
  if (adapterCandidates.length === 0) {
    unknowns.push("adapter/framework 相当への依存が少なく ALR の判定根拠が限定的です");
  }
  findings.push(
    ...adapterLeaks.map(({ dependency, sourceLayer, targetLayer }) => ({
      kind: "adapter_leak" as const,
      path: dependency.source,
      source: dependency.source,
      target: dependency.target,
      sourceLayer: sourceLayer.name,
      targetLayer: targetLayer.name,
      confidence: 0.92,
      note: `${sourceLayer.name} から ${targetLayer.name} の framework/adapter 相当へ直接依存しています`
    }))
  );

  const frameworkishFiles = classifiedFiles.filter(({ path, layer }) => isFrameworkish(path, layer.name));
  const frameworkContaminations = frameworkishFiles.filter(({ layer }) => !isAllowedFrameworkLayer(layer, maxRank));
  const FCC =
    frameworkishFiles.length === 0 ? 0.6 : 1 - frameworkContaminations.length / Math.max(1, frameworkishFiles.length);
  if (frameworkishFiles.length === 0) {
    unknowns.push("framework/adapter 相当のファイルが少なく FCC は保守的な近似です");
  }
  findings.push(
    ...frameworkContaminations.map(({ path, layer }) => ({
      kind: "framework_contamination" as const,
      path,
      sourceLayer: layer.name,
      confidence: 0.86,
      note: `${layer.name} に framework/adapter 相当の実装が混入しています`
    }))
  );

  const internalTargetMap = new Map<
    string,
    {
      targetLayer: string;
      sourceLayers: Set<string>;
    }
  >();
  for (const { dependency, sourceLayer, targetLayer } of classifiedEdges) {
    if (!isInternalish(dependency.target, targetLayer.name)) {
      continue;
    }
    const entry = internalTargetMap.get(dependency.target) ?? {
      targetLayer: targetLayer.name,
      sourceLayers: new Set<string>()
    };
    entry.sourceLayers.add(sourceLayer.name);
    internalTargetMap.set(dependency.target, entry);
  }

  const internalTargets = Array.from(internalTargetMap.entries());
  const sharedInternalTargets = internalTargets.filter(([, entry]) => entry.sourceLayers.size > 1);
  const SICR =
    internalTargets.length === 0 ? 0 : sharedInternalTargets.length / Math.max(1, internalTargets.length);
  if (internalTargets.length === 0) {
    unknowns.push("共有判定できる internal component が少なく SICR の根拠が限定的です");
  }
  findings.push(
    ...sharedInternalTargets.map(([path, entry]) => ({
      kind: "shared_internal_component" as const,
      path,
      target: path,
      targetLayer: entry.targetLayer,
      confidence: 0.88,
      note: `${path} が複数 layer (${Array.from(entry.sourceLayers).join(", ")}) から共有されています`
    }))
  );

  const confidence = clamp01(
    average(
      [
        classifiedEdges.length > 0 ? 0.85 : 0.5,
        adapterCandidates.length > 0 ? 0.82 : 0.6,
        frameworkishFiles.length > 0 ? 0.8 : 0.58,
        internalTargets.length > 0 ? 0.8 : 0.58
      ],
      0.6
    )
  );

  return {
    ALR,
    FCC,
    SICR,
    confidence,
    unknowns: Array.from(new Set(unknowns)),
    findings
  };
}
