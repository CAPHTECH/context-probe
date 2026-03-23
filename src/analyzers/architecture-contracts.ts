import path from "node:path";

import ts from "typescript";

import type { ArchitectureConstraints, CodebaseAnalysis, LayerDefinition, ParsedSourceFile } from "../core/contracts.js";
import { readText } from "../core/io.js";
import { classifyArchitectureLayer, collectContractFilePaths } from "./contract-files.js";
import { getScorableDependencies } from "./code.js";

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

const INTERNAL_SIGNAL = /(internal|infra|infrastructure|implementation|impl|adapter|adapters|controller|controllers|logger|gateway|gateways)/i;
const DART_CLASS_PATTERN = /^(?:(?:abstract|base|interface|final|sealed)\s+)*class\s+([A-Za-z_]\w*)\b/;
const DART_MIXIN_CLASS_PATTERN = /^(?:(?:base|abstract)\s+)*mixin\s+class\s+([A-Za-z_]\w*)\b/;
const DART_ENUM_PATTERN = /^enum\s+([A-Za-z_]\w*)\b/;
const DART_TYPEDEF_PATTERN = /^typedef\s+([A-Za-z_]\w*)\b/;
const DART_EXTENSION_TYPE_PATTERN = /^extension\s+type\s+([A-Za-z_]\w*)\b/;
const DART_FUNCTION_PATTERN =
  /^(?:external\s+)?(?:[A-Za-z_<>\[\]?., ]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:=>|\{)/;
const DART_VALUE_PATTERN =
  /^(?:late\s+final|late|final|const|var|[A-Za-z_<>\[\]?., ]+)\s+([A-Za-z_]\w*)\s*=/;

function classifyLayer(filePath: string, constraints: ArchitectureConstraints): LayerDefinition | undefined {
  return classifyArchitectureLayer(filePath, constraints);
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

function isStableEcmaExport(node: ts.Node): boolean {
  return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);
}

function isRiskyEcmaExport(node: ts.Node): boolean {
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

function stripComments(sourceText: string): string {
  return sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function countBraceDelta(line: string): number {
  const opens = line.match(/\{/g)?.length ?? 0;
  const closes = line.match(/\}/g)?.length ?? 0;
  return opens - closes;
}

function isPublicDartSymbol(symbol: string | undefined): symbol is string {
  return Boolean(symbol && !symbol.startsWith("_"));
}

function collectDartTopLevelLines(sourceText: string): string[] {
  const lines = stripComments(sourceText).split("\n");
  const topLevelLines: string[] = [];
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (braceDepth === 0 && trimmed.length > 0 && !trimmed.startsWith("@")) {
      topLevelLines.push(trimmed);
    }
    braceDepth = Math.max(0, braceDepth + countBraceDelta(line));
  }

  return topLevelLines;
}

function analyzeEcmaContractDeclarations(pathValue: string, sourceText: string): Omit<ContractFileStats, "path" | "totalImports" | "nonContractImports" | "internalImports"> {
  const sourceFile = ts.createSourceFile(pathValue, sourceText, ts.ScriptTarget.ES2022, true);
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
    if (isStableEcmaExport(node)) {
      stableExports += 1;
    }
    if (isRiskyEcmaExport(node)) {
      riskyExports += 1;
      const symbol = getDeclarationName(node);
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: pathValue,
        confidence: 0.86,
        note: `${pathValue} exports a public contract outside interface/type/enum declarations.`,
        ...(symbol ? { symbol } : {})
      });
    }
    if (declarationContainsAny(node, sourceFile)) {
      anyExports += 1;
      const symbol = getDeclarationName(node);
      findings.push({
        kind: "breaking_change_risk",
        path: pathValue,
        confidence: 0.88,
        note: `${pathValue} contains 'any' in a public contract.`,
        ...(symbol ? { symbol } : {})
      });
    }
  });

  return {
    exportCount,
    stableExports,
    riskyExports,
    anyExports,
    findings
  };
}

function analyzeDartContractDeclarations(pathValue: string, sourceText: string): Omit<ContractFileStats, "path" | "totalImports" | "nonContractImports" | "internalImports"> {
  const findings: ContractStabilityFinding[] = [];
  const topLevelLines = collectDartTopLevelLines(sourceText);
  let exportCount = 0;
  let stableExports = 0;
  let riskyExports = 0;
  let anyExports = 0;

  for (const line of topLevelLines) {
    let symbol: string | undefined;
    let stable = false;
    let risky = false;

    symbol =
      DART_MIXIN_CLASS_PATTERN.exec(line)?.[1] ??
      DART_CLASS_PATTERN.exec(line)?.[1] ??
      DART_ENUM_PATTERN.exec(line)?.[1] ??
      DART_TYPEDEF_PATTERN.exec(line)?.[1] ??
      DART_EXTENSION_TYPE_PATTERN.exec(line)?.[1];
    if (isPublicDartSymbol(symbol)) {
      stable = true;
    } else {
      symbol = DART_FUNCTION_PATTERN.exec(line)?.[1] ?? DART_VALUE_PATTERN.exec(line)?.[1];
      if (isPublicDartSymbol(symbol)) {
        risky = true;
      }
    }

    if (!stable && !risky) {
      continue;
    }

    exportCount += 1;
    if (stable) {
      stableExports += 1;
    }
    if (risky) {
      riskyExports += 1;
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: pathValue,
        confidence: 0.84,
        note: `${pathValue} contains a public contract derived from a function or value.`,
        ...(symbol ? { symbol } : {})
      });
    }
    if (/\bdynamic\b/.test(line)) {
      anyExports += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: pathValue,
        confidence: 0.88,
        note: `${pathValue} contains 'dynamic' in a public contract.`,
        ...(symbol ? { symbol } : {})
      });
    }
  }

  return {
    exportCount,
    stableExports,
    riskyExports,
    anyExports,
    findings
  };
}

function getParsedFileMap(codebase: CodebaseAnalysis): Map<string, ParsedSourceFile> {
  return new Map(codebase.files.map((file) => [file.path, file]));
}

async function analyzeContractFile(options: {
  root: string;
  path: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  contractFiles: Set<string>;
  fileMap: Map<string, ParsedSourceFile>;
}): Promise<ContractFileStats> {
  const sourceText = await readText(path.join(options.root, options.path));
  const parsedFile = options.fileMap.get(options.path);
  const declarationStats =
    parsedFile?.language === "dart"
      ? analyzeDartContractDeclarations(options.path, sourceText)
      : analyzeEcmaContractDeclarations(options.path, sourceText);
  const dependencies = getScorableDependencies(options.codebase).filter(
    (dependency) => dependency.source === options.path && dependency.targetKind === "file" && dependency.kind !== "part"
  );
  const findings: ContractStabilityFinding[] = [...declarationStats.findings];
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
        note: `${options.path} references a non-contract file: ${dependency.target}.`
      });
    }
    if (isInternalishFile(dependency.target, targetLayer?.name)) {
      internalImports += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: options.path,
        symbol: dependency.specifier,
        confidence: 0.92,
        note: `${options.path} references an internal/framework-like file: ${dependency.target}.`
      });
    }
  }

  return {
    path: options.path,
    exportCount: declarationStats.exportCount,
    stableExports: declarationStats.stableExports,
    riskyExports: declarationStats.riskyExports,
    anyExports: declarationStats.anyExports,
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
  const contractPaths = collectContractFilePaths({
    codebase: options.codebase,
    constraints: options.constraints,
    allowDartDomainFallback: true
  });
  const contractFiles = new Set(contractPaths);
  const fileMap = getParsedFileMap(options.codebase);
  const unknowns: string[] = [
    "CBC/BCR are current-state contract-stability proxies, not baseline deltas."
  ];

  if (contractPaths.length === 0) {
    return {
      CBC: 0.5,
      BCR: 0.5,
      SLA: 0.5,
      confidence: 0.45,
      unknowns: [...unknowns, "There are too few contract files, so IPS is conservative."],
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
        contractFiles,
        fileMap
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
    unknowns.push("There are too few contract imports, so SLA evidence is limited.");
  }
  if (totalExports === 0) {
    unknowns.push("There are too few public contract exports, so CBC evidence is limited.");
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
