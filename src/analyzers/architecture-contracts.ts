import path from "node:path";

import ts from "typescript";

import type { ArchitectureConstraints, CodebaseAnalysis, LayerDefinition } from "../core/contracts.js";
import { matchGlobs, readText } from "../core/io.js";

export interface ContractStabilityFinding {
  kind: "contract_backward_compatibility_risk" | "breaking_change_risk" | "schema_language_violation";
  path: string;
  symbol?: string;
  confidence: number;
  note: string;
}

export interface InterfaceProtocolStabilityScore {
  CBC: number;
  BCR: number;
  SLA: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

interface ContractFileStats {
  path: string;
  exportCount: number;
  stableExports: number;
  riskyExports: number;
  anyExports: number;
  totalImports: number;
  nonContractImports: number;
  internalImports: number;
  findings: ContractStabilityFinding[];
}

const CONTRACT_FILE_SIGNAL = /(^|\/)(contracts?|dtos?|events?|schemas?|protocols?)(\/|$)|(?:contract|dto|event|schema|protocol)s?\.[^.]+$/i;
const INTERNAL_SIGNAL = /(internal|infra|infrastructure|implementation|impl|adapter|adapters|controller|controllers|repository|logger|gateway|gateways)/i;

function classifyLayer(filePath: string, constraints: ArchitectureConstraints): LayerDefinition | undefined {
  return constraints.layers.find((layer) => matchGlobs(filePath, layer.globs));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isContractishFile(filePath: string): boolean {
  return CONTRACT_FILE_SIGNAL.test(filePath);
}

function isInternalishFile(filePath: string, layerName?: string): boolean {
  return INTERNAL_SIGNAL.test(filePath) || (layerName ? INTERNAL_SIGNAL.test(layerName) : false);
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return Boolean(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function getDeclarationName(node: ts.Node): string | undefined {
  const namedNode = node as ts.NamedDeclaration;
  if (namedNode.name && ts.isIdentifier(namedNode.name)) {
    return namedNode.name.text;
  }
  return undefined;
}

function isStableExport(node: ts.Node): boolean {
  return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);
}

function isRiskyExport(node: ts.Node): boolean {
  return (
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isVariableStatement(node) ||
    ts.isExportAssignment(node)
  );
}

function declarationContainsAny(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  return /\bany\b/.test(node.getText(sourceFile));
}

async function analyzeContractFile(options: {
  root: string;
  path: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  contractFiles: Set<string>;
}): Promise<ContractFileStats> {
  const sourceText = await readText(path.join(options.root, options.path));
  const sourceFile = ts.createSourceFile(options.path, sourceText, ts.ScriptTarget.ES2022, true);
  const dependencies = options.codebase.dependencies.filter(
    (dependency) => dependency.source === options.path && dependency.targetKind === "file"
  );
  const findings: ContractStabilityFinding[] = [];
  let exportCount = 0;
  let stableExports = 0;
  let riskyExports = 0;
  let anyExports = 0;

  sourceFile.forEachChild((node) => {
    if (!hasExportModifier(node) && !ts.isExportAssignment(node)) {
      return;
    }
    exportCount += 1;
    if (isStableExport(node)) {
      stableExports += 1;
    }
    if (isRiskyExport(node)) {
      riskyExports += 1;
      const symbol = getDeclarationName(node);
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: options.path,
        confidence: 0.86,
        note: `${options.path} が interface/type/enum 以外の公開契約を export しています`,
        ...(symbol ? { symbol } : {})
      });
    }
    if (declarationContainsAny(node, sourceFile)) {
      anyExports += 1;
      const symbol = getDeclarationName(node);
      findings.push({
        kind: "breaking_change_risk",
        path: options.path,
        confidence: 0.88,
        note: `${options.path} の公開契約が any を含んでいます`,
        ...(symbol ? { symbol } : {})
      });
    }
  });

  let nonContractImports = 0;
  let internalImports = 0;
  for (const dependency of dependencies) {
    const targetLayer = classifyLayer(dependency.target, options.constraints);
    const targetIsContract = options.contractFiles.has(dependency.target);
    if (!targetIsContract) {
      nonContractImports += 1;
      findings.push({
        kind: "schema_language_violation",
        path: options.path,
        symbol: dependency.specifier,
        confidence: 0.9,
        note: `${options.path} が非契約ファイル ${dependency.target} を参照しています`
      });
    }
    if (isInternalishFile(dependency.target, targetLayer?.name)) {
      internalImports += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: options.path,
        symbol: dependency.specifier,
        confidence: 0.92,
        note: `${options.path} が internal/framework 相当の ${dependency.target} を参照しています`
      });
    }
  }

  return {
    path: options.path,
    exportCount,
    stableExports,
    riskyExports,
    anyExports,
    totalImports: dependencies.length,
    nonContractImports,
    internalImports,
    findings
  };
}

export async function scoreInterfaceProtocolStability(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
}): Promise<InterfaceProtocolStabilityScore> {
  const contractPaths = options.codebase.sourceFiles.filter((filePath) => isContractishFile(filePath));
  const contractFiles = new Set(contractPaths);
  const unknowns: string[] = [
    "CBC/BCR はベースライン差分ではなく現時点の契約安定性 proxy です"
  ];

  if (contractPaths.length === 0) {
    return {
      CBC: 0.5,
      BCR: 0.5,
      SLA: 0.5,
      confidence: 0.45,
      unknowns: [...unknowns, "契約ファイルが少なく IPS は保守的な近似です"],
      findings: []
    };
  }

  const stats = await Promise.all(
    contractPaths.map((filePath) =>
      analyzeContractFile({
        root: options.root,
        path: filePath,
        codebase: options.codebase,
        constraints: options.constraints,
        contractFiles
      })
    )
  );

  const totalExports = stats.reduce((sum, entry) => sum + entry.exportCount, 0);
  const stableExports = stats.reduce((sum, entry) => sum + entry.stableExports, 0);
  const totalImports = stats.reduce((sum, entry) => sum + entry.totalImports, 0);
  const nonContractImports = stats.reduce((sum, entry) => sum + entry.nonContractImports, 0);
  const internalImports = stats.reduce((sum, entry) => sum + entry.internalImports, 0);
  const riskyExports = stats.reduce((sum, entry) => sum + entry.riskyExports + entry.anyExports, 0);
  const riskSignals = riskyExports + nonContractImports + internalImports;

  const stableExportRatio = totalExports === 0 ? 0.5 : stableExports / totalExports;
  const importAdherence = totalImports === 0 ? 1 : 1 - nonContractImports / Math.max(1, totalImports);
  const cleanContractFileRatio =
    stats.filter(
      (entry) =>
        entry.riskyExports === 0 &&
        entry.anyExports === 0 &&
        entry.nonContractImports === 0 &&
        entry.internalImports === 0
    ).length / Math.max(1, stats.length);

  const CBC = clamp01(stableExportRatio * (1 - Math.min(1, riskSignals / Math.max(1, totalExports + totalImports)) * 0.35));
  const BCR = clamp01(riskSignals / Math.max(1, totalExports + totalImports + stats.length));
  const SLA = clamp01(0.6 * importAdherence + 0.4 * cleanContractFileRatio);

  if (totalImports === 0) {
    unknowns.push("契約 import が少なく SLA の根拠が限定的です");
  }
  if (totalExports === 0) {
    unknowns.push("公開契約 export が少なく CBC の根拠が限定的です");
  }

  return {
    CBC,
    BCR,
    SLA,
    confidence: clamp01(
      average(
        [
          contractPaths.length > 0 ? 0.8 : 0.45,
          totalExports > 0 ? 0.82 : 0.55,
          totalImports > 0 ? 0.75 : 0.6,
          riskSignals > 0 ? 0.85 : 0.72
        ],
        0.6
      )
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings: stats.flatMap((entry) => entry.findings)
  };
}
