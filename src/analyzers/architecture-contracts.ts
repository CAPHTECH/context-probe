import path from "node:path";

import ts from "typescript";

import type {
  ArchitectureConstraints,
  ArchitectureContractBaseline,
  ArchitectureContractBaselineEntry,
  ArchitectureContractBaselineSymbol,
  ArchitectureContractBaselineSymbolKind,
  CodebaseAnalysis,
  LayerDefinition,
  ParsedSourceFile,
} from "../core/contracts.js";
import { readText } from "../core/io.js";
import { getScorableDependencies } from "./code.js";
import { classifyArchitectureLayer, collectContractFilePaths, isMeasuredContractFilePath } from "./contract-files.js";

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
  symbols: ArchitectureContractBaselineSymbol[];
  findings: ContractStabilityFinding[];
}

interface BaselineComparisonSummary {
  CBC: number;
  BCR: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
}

const INTERNAL_SIGNAL =
  /(internal|infra|infrastructure|implementation|impl|adapter|adapters|controller|controllers|logger|gateway|gateways)/i;
const DART_CLASS_PATTERN = /^(?:(?:abstract|base|interface|final|sealed)\s+)*class\s+([A-Za-z_]\w*)\b/;
const DART_MIXIN_CLASS_PATTERN = /^(?:(?:base|abstract)\s+)*mixin\s+class\s+([A-Za-z_]\w*)\b/;
const DART_ENUM_PATTERN = /^enum\s+([A-Za-z_]\w*)\b/;
const DART_TYPEDEF_PATTERN = /^typedef\s+([A-Za-z_]\w*)\b/;
const DART_EXTENSION_TYPE_PATTERN = /^extension\s+type\s+([A-Za-z_]\w*)\b/;
const DART_FUNCTION_PATTERN = /^(?:external\s+)?(?:[A-Za-z_<>[\]?., ]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:=>|\{)/;
const DART_VALUE_PATTERN = /^(?:late\s+final|late|final|const|var|[A-Za-z_<>[\]?., ]+)\s+([A-Za-z_]\w*)\s*=/;

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

function createContractSymbol(input: {
  name: string;
  kind: ArchitectureContractBaselineSymbolKind;
  stability: "stable" | "risky";
  loose: boolean;
}): ArchitectureContractBaselineSymbol {
  return {
    name: input.name,
    kind: input.kind,
    stability: input.stability,
    looseness: input.loose ? "loose" : "strict",
  };
}

function uniqueSymbols(symbols: ArchitectureContractBaselineSymbol[]): ArchitectureContractBaselineSymbol[] {
  const seen = new Set<string>();
  const results: ArchitectureContractBaselineSymbol[] = [];

  for (const symbol of symbols) {
    const key = `${symbol.name}:${symbol.kind}:${symbol.stability}:${symbol.looseness}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(symbol);
  }

  return results;
}

function getVariableDeclarationNames(node: ts.VariableStatement): string[] {
  return node.declarationList.declarations.flatMap((declaration) => {
    if (ts.isIdentifier(declaration.name)) {
      return [declaration.name.text];
    }
    return [];
  });
}

function analyzeEcmaContractDeclarations(
  pathValue: string,
  sourceText: string,
): Omit<ContractFileStats, "path" | "totalImports" | "nonContractImports" | "internalImports"> {
  const sourceFile = ts.createSourceFile(pathValue, sourceText, ts.ScriptTarget.ES2022, true);
  const findings: ContractStabilityFinding[] = [];
  const symbols: ArchitectureContractBaselineSymbol[] = [];
  let exportCount = 0;
  let stableExports = 0;
  let riskyExports = 0;
  let anyExports = 0;

  sourceFile.forEachChild((node) => {
    if (!hasExportModifier(node) && !ts.isExportAssignment(node)) {
      return;
    }

    const loose = declarationContainsAny(node, sourceFile);
    if (loose) {
      anyExports += 1;
    }

    if (isStableEcmaExport(node)) {
      exportCount += 1;
      stableExports += 1;
      const symbol = getDeclarationName(node);
      const kind: ArchitectureContractBaselineSymbolKind = ts.isInterfaceDeclaration(node)
        ? "interface"
        : ts.isTypeAliasDeclaration(node)
          ? "type_alias"
          : "enum";
      if (symbol) {
        symbols.push(
          createContractSymbol({
            name: symbol,
            kind,
            stability: "stable",
            loose,
          }),
        );
      }
      if (loose) {
        findings.push({
          kind: "breaking_change_risk",
          path: pathValue,
          confidence: 0.88,
          note: `${pathValue} contains 'any' in a public contract.`,
          ...(symbol ? { symbol } : {}),
        });
      }
      return;
    }

    if (!isRiskyEcmaExport(node)) {
      return;
    }

    exportCount += 1;
    riskyExports += 1;

    const symbolNames = ts.isVariableStatement(node)
      ? getVariableDeclarationNames(node)
      : [getDeclarationName(node) ?? (ts.isExportAssignment(node) ? "default" : "default")];
    const kind: ArchitectureContractBaselineSymbolKind = ts.isClassDeclaration(node)
      ? "class"
      : ts.isFunctionDeclaration(node)
        ? "function"
        : ts.isVariableStatement(node)
          ? "value"
          : "default_export";

    if (symbolNames.length === 0) {
      symbolNames.push("default");
    }

    for (const symbol of symbolNames) {
      symbols.push(
        createContractSymbol({
          name: symbol,
          kind,
          stability: "risky",
          loose,
        }),
      );
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: pathValue,
        confidence: 0.86,
        note: `${pathValue} exports a public contract outside interface/type/enum declarations.`,
        ...(symbol ? { symbol } : {}),
      });
      if (loose) {
        findings.push({
          kind: "breaking_change_risk",
          path: pathValue,
          confidence: 0.88,
          note: `${pathValue} contains 'any' in a public contract.`,
          ...(symbol ? { symbol } : {}),
        });
      }
    }
  });

  return {
    exportCount,
    stableExports,
    riskyExports,
    anyExports,
    symbols: uniqueSymbols(symbols),
    findings,
  };
}

function analyzeDartContractDeclarations(
  pathValue: string,
  sourceText: string,
): Omit<ContractFileStats, "path" | "totalImports" | "nonContractImports" | "internalImports"> {
  const findings: ContractStabilityFinding[] = [];
  const symbols: ArchitectureContractBaselineSymbol[] = [];
  const topLevelLines = collectDartTopLevelLines(sourceText);
  let exportCount = 0;
  let stableExports = 0;
  let riskyExports = 0;
  let anyExports = 0;

  for (const line of topLevelLines) {
    let symbol: string | undefined;
    let kind: ArchitectureContractBaselineSymbolKind | undefined;
    let stable = false;
    let risky = false;

    symbol = DART_MIXIN_CLASS_PATTERN.exec(line)?.[1];
    if (isPublicDartSymbol(symbol)) {
      stable = true;
      kind = "class";
    } else {
      symbol = DART_CLASS_PATTERN.exec(line)?.[1];
      if (isPublicDartSymbol(symbol)) {
        stable = true;
        kind = "class";
      } else {
        symbol = DART_ENUM_PATTERN.exec(line)?.[1];
        if (isPublicDartSymbol(symbol)) {
          stable = true;
          kind = "enum";
        } else {
          symbol = DART_TYPEDEF_PATTERN.exec(line)?.[1];
          if (isPublicDartSymbol(symbol)) {
            stable = true;
            kind = "type_alias";
          } else {
            symbol = DART_EXTENSION_TYPE_PATTERN.exec(line)?.[1];
            if (isPublicDartSymbol(symbol)) {
              stable = true;
              kind = "type_alias";
            } else {
              symbol = DART_FUNCTION_PATTERN.exec(line)?.[1] ?? DART_VALUE_PATTERN.exec(line)?.[1];
              if (isPublicDartSymbol(symbol)) {
                risky = true;
                kind = DART_FUNCTION_PATTERN.test(line) ? "function" : "value";
              }
            }
          }
        }
      }
    }

    if ((!stable && !risky) || !symbol || !kind) {
      continue;
    }

    exportCount += 1;
    const loose = /\bdynamic\b/.test(line);
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
        ...(symbol ? { symbol } : {}),
      });
    }
    if (loose) {
      anyExports += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: pathValue,
        confidence: 0.88,
        note: `${pathValue} contains 'dynamic' in a public contract.`,
        ...(symbol ? { symbol } : {}),
      });
    }
    symbols.push(
      createContractSymbol({
        name: symbol,
        kind,
        stability: stable ? "stable" : "risky",
        loose,
      }),
    );
  }

  return {
    exportCount,
    stableExports,
    riskyExports,
    anyExports,
    symbols: uniqueSymbols(symbols),
    findings,
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
    (dependency) =>
      dependency.source === options.path && dependency.targetKind === "file" && dependency.kind !== "part",
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
        note: `${options.path} references a non-contract file: ${dependency.target}.`,
      });
    }
    if (isInternalishFile(dependency.target, targetLayer?.name)) {
      internalImports += 1;
      findings.push({
        kind: "breaking_change_risk",
        path: options.path,
        symbol: dependency.specifier,
        confidence: 0.92,
        note: `${options.path} references an internal/framework-like file: ${dependency.target}.`,
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
    symbols: declarationStats.symbols,
    findings,
  };
}

function toContractBaselineEntry(stats: ContractFileStats): ArchitectureContractBaselineEntry {
  return {
    path: stats.path,
    symbols: stats.symbols,
    imports: {
      total: stats.totalImports,
      nonContract: stats.nonContractImports,
      internal: stats.internalImports,
    },
  };
}

function buildCurrentStateScore(stats: ContractFileStats[]): {
  CBC: number;
  BCR: number;
  SLA: number;
  confidence: number;
  unknowns: string[];
  findings: ContractStabilityFinding[];
} {
  const totalExports = stats.reduce((sum, entry) => sum + entry.exportCount, 0);
  const stableExports = stats.reduce((sum, entry) => sum + entry.stableExports, 0);
  const totalImports = stats.reduce((sum, entry) => sum + entry.totalImports, 0);
  const nonContractImports = stats.reduce((sum, entry) => sum + entry.nonContractImports, 0);
  const internalImports = stats.reduce((sum, entry) => sum + entry.internalImports, 0);
  const riskyExports = stats.reduce((sum, entry) => sum + entry.riskyExports + entry.anyExports, 0);
  const riskSignals = riskyExports + nonContractImports + internalImports;
  const unknowns: string[] = ["CBC/BCR are current-state contract-stability proxies, not baseline deltas."];

  const stableExportRatio = totalExports === 0 ? 0.5 : stableExports / totalExports;
  const importAdherence = totalImports === 0 ? 1 : 1 - nonContractImports / Math.max(1, totalImports);
  const cleanContractFileRatio =
    stats.filter(
      (entry) =>
        entry.riskyExports === 0 &&
        entry.anyExports === 0 &&
        entry.nonContractImports === 0 &&
        entry.internalImports === 0,
    ).length / Math.max(1, stats.length);

  const CBC = clamp01(
    stableExportRatio * (1 - Math.min(1, riskSignals / Math.max(1, totalExports + totalImports)) * 0.35),
  );
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
          stats.length > 0 ? 0.8 : 0.45,
          totalExports > 0 ? 0.82 : 0.55,
          totalImports > 0 ? 0.75 : 0.6,
          riskSignals > 0 ? 0.85 : 0.72,
        ],
        0.6,
      ),
    ),
    unknowns: Array.from(new Set(unknowns)),
    findings: stats.flatMap((entry) => entry.findings),
  };
}

function compareAgainstBaseline(options: {
  baseline: ArchitectureContractBaseline;
  currentStats: ContractFileStats[];
  constraints: ArchitectureConstraints;
}): BaselineComparisonSummary | undefined {
  const unknowns: string[] = [];
  const findings: ContractStabilityFinding[] = [];
  const currentByPath = new Map(options.currentStats.map((entry) => [entry.path, entry]));
  const baselineContracts = Array.isArray(options.baseline.contracts) ? options.baseline.contracts : [];
  const inScopeBaselineEntries = baselineContracts.filter((entry) =>
    isMeasuredContractFilePath({
      filePath: entry.path,
      constraints: options.constraints,
      allowDartDomainFallback: true,
    }),
  );
  const ignoredBaselineEntries = baselineContracts.length - inScopeBaselineEntries.length;

  if (ignoredBaselineEntries > 0) {
    unknowns.push(
      `${ignoredBaselineEntries} contract baseline entries are outside the current architecture scope and were ignored.`,
    );
  }

  if (inScopeBaselineEntries.length === 0) {
    return undefined;
  }

  let baselineSymbolCount = 0;
  let comparedFiles = 0;
  let baselineEntriesWithoutImportStats = 0;
  let removedSymbols = 0;
  let regressedSymbols = 0;
  let loosenedSymbols = 0;
  let newRiskySymbols = 0;
  let importRiskDeltas = 0;
  let baselineImportTotal = 0;

  for (const baselineEntry of inScopeBaselineEntries) {
    const baselineSymbols = baselineEntry.symbols ?? [];
    baselineSymbolCount += baselineSymbols.length;
    const currentEntry = currentByPath.get(baselineEntry.path);
    if (!currentEntry) {
      const removedCount = Math.max(1, baselineSymbols.length);
      removedSymbols += removedCount;
      findings.push({
        kind: "contract_backward_compatibility_risk",
        path: baselineEntry.path,
        confidence: 0.94,
        note: `${baselineEntry.path} existed in the contract baseline but is no longer present in the current contract surface.`,
      });
      continue;
    }

    comparedFiles += 1;
    const currentSymbolsByName = new Map(currentEntry.symbols.map((symbol) => [symbol.name, symbol]));
    for (const baselineSymbol of baselineSymbols) {
      const currentSymbol = currentSymbolsByName.get(baselineSymbol.name);
      if (!currentSymbol) {
        removedSymbols += 1;
        findings.push({
          kind: "contract_backward_compatibility_risk",
          path: baselineEntry.path,
          confidence: 0.94,
          note: `${baselineEntry.path} removed public contract symbol ${baselineSymbol.name} since the baseline snapshot.`,
          symbol: baselineSymbol.name,
        });
        continue;
      }
      if (baselineSymbol.stability === "stable" && currentSymbol.stability === "risky") {
        regressedSymbols += 1;
        findings.push({
          kind: "contract_backward_compatibility_risk",
          path: baselineEntry.path,
          confidence: 0.93,
          note: `${baselineEntry.path} regressed ${baselineSymbol.name} from a stable contract declaration to an implementation-coupled export.`,
          symbol: baselineSymbol.name,
        });
      }
      if (baselineSymbol.looseness === "strict" && currentSymbol.looseness === "loose") {
        loosenedSymbols += 1;
        findings.push({
          kind: "breaking_change_risk",
          path: baselineEntry.path,
          confidence: 0.92,
          note: `${baselineEntry.path} loosened ${baselineSymbol.name} since the baseline snapshot.`,
          symbol: baselineSymbol.name,
        });
      }
    }

    const baselineSymbolNames = new Set(baselineSymbols.map((symbol) => symbol.name));
    newRiskySymbols += currentEntry.symbols.filter(
      (symbol) =>
        !baselineSymbolNames.has(symbol.name) && (symbol.stability === "risky" || symbol.looseness === "loose"),
    ).length;

    if (baselineEntry.imports) {
      baselineImportTotal += baselineEntry.imports.total;
      importRiskDeltas += Math.max(0, currentEntry.nonContractImports - baselineEntry.imports.nonContract);
      importRiskDeltas += Math.max(0, currentEntry.internalImports - baselineEntry.imports.internal);
    } else {
      baselineEntriesWithoutImportStats += 1;
    }
  }

  if (baselineEntriesWithoutImportStats > 0) {
    unknowns.push(
      `${baselineEntriesWithoutImportStats} contract baseline entries do not include import statistics, so BCR import deltas are partial.`,
    );
  }

  if (comparedFiles < inScopeBaselineEntries.length) {
    unknowns.push(
      `The contract baseline covered ${comparedFiles}/${inScopeBaselineEntries.length} in-scope baseline files in the current repo.`,
    );
  }

  const currentContractFileCount = options.currentStats.length;
  const currentPaths = new Set(options.currentStats.map((entry) => entry.path));
  const baselinePaths = new Set(inScopeBaselineEntries.map((entry) => entry.path));
  const currentFilesOutsideBaseline =
    currentContractFileCount - Array.from(currentPaths).filter((pathValue) => baselinePaths.has(pathValue)).length;
  if (currentFilesOutsideBaseline > 0) {
    unknowns.push(
      `The contract baseline does not cover ${currentFilesOutsideBaseline} current contract files, so CBC/BCR are partial.`,
    );
  }

  const compatibilityFailures = removedSymbols + regressedSymbols + loosenedSymbols;
  const deltaRiskSignals = compatibilityFailures + newRiskySymbols + importRiskDeltas;
  const cbcDenominator = Math.max(1, baselineSymbolCount);
  const bcrDenominator = Math.max(1, baselineSymbolCount + baselineImportTotal + currentFilesOutsideBaseline);

  return {
    CBC: clamp01(1 - compatibilityFailures / cbcDenominator),
    BCR: clamp01(deltaRiskSignals / bcrDenominator),
    confidence: clamp01(
      average(
        [
          0.84,
          comparedFiles > 0 ? comparedFiles / Math.max(1, inScopeBaselineEntries.length) : 0.4,
          baselineSymbolCount > 0 ? 0.88 : 0.55,
          baselineEntriesWithoutImportStats === 0 ? 0.86 : 0.7,
        ],
        0.65,
      ),
    ),
    unknowns,
    findings,
  };
}

async function collectContractFileStats(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
}): Promise<ContractFileStats[]> {
  const contractPaths = collectContractFilePaths({
    codebase: options.codebase,
    constraints: options.constraints,
    allowDartDomainFallback: true,
  });
  const contractFiles = new Set(contractPaths);
  const fileMap = getParsedFileMap(options.codebase);

  return Promise.all(
    contractPaths.map((filePath) =>
      analyzeContractFile({
        root: options.root,
        path: filePath,
        codebase: options.codebase,
        constraints: options.constraints,
        contractFiles,
        fileMap,
      }),
    ),
  );
}

export async function captureInterfaceProtocolBaseline(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  capturedAt?: string;
  note?: string;
}): Promise<ArchitectureContractBaseline> {
  const stats = await collectContractFileStats(options);
  return {
    version: "1.0",
    ...(options.capturedAt || options.note
      ? {
          snapshot: {
            ...(options.capturedAt ? { sourceKind: "captured", capturedAt: options.capturedAt } : {}),
            ...(options.note ? { note: options.note } : {}),
          },
        }
      : {}),
    contracts: stats.map((entry) => toContractBaselineEntry(entry)),
  };
}

export async function scoreInterfaceProtocolStability(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  baseline?: ArchitectureContractBaseline;
}): Promise<InterfaceProtocolStabilityScore> {
  const stats = await collectContractFileStats(options);
  const contractPaths = stats.map((entry) => entry.path);

  if (contractPaths.length === 0) {
    return {
      CBC: 0.5,
      BCR: 0.5,
      SLA: 0.5,
      confidence: 0.45,
      unknowns: ["There are too few contract files, so IPS is conservative."],
      findings: [],
    };
  }

  const currentState = buildCurrentStateScore(stats);
  const baselineComparison = options.baseline
    ? compareAgainstBaseline({
        baseline: options.baseline,
        currentStats: stats,
        constraints: options.constraints,
      })
    : undefined;

  const totalImports = stats.reduce((sum, entry) => sum + entry.totalImports, 0);
  const importAdherence =
    totalImports === 0
      ? 1
      : 1 - stats.reduce((sum, entry) => sum + entry.nonContractImports, 0) / Math.max(1, totalImports);
  const cleanContractFileRatio =
    stats.filter(
      (entry) =>
        entry.riskyExports === 0 &&
        entry.anyExports === 0 &&
        entry.nonContractImports === 0 &&
        entry.internalImports === 0,
    ).length / Math.max(1, stats.length);
  const SLA = clamp01(0.6 * importAdherence + 0.4 * cleanContractFileRatio);

  const mergedUnknowns = baselineComparison
    ? [
        ...baselineComparison.unknowns,
        ...(totalImports === 0 ? ["There are too few contract imports, so SLA evidence is limited."] : []),
      ]
    : currentState.unknowns;
  const mergedFindings = baselineComparison
    ? [...currentState.findings, ...baselineComparison.findings]
    : currentState.findings;
  const confidence = baselineComparison
    ? clamp01(average([currentState.confidence, baselineComparison.confidence], currentState.confidence))
    : currentState.confidence;

  return {
    CBC: baselineComparison?.CBC ?? currentState.CBC,
    BCR: baselineComparison?.BCR ?? currentState.BCR,
    SLA,
    confidence,
    unknowns: Array.from(new Set(mergedUnknowns)),
    findings: mergedFindings,
  };
}
