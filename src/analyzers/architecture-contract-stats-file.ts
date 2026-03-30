import path from "node:path";

import type {
  ArchitectureConstraints,
  ArchitectureContractBaselineEntry,
  ArchitectureContractBaselineSymbol,
  CodebaseAnalysis,
  LayerDefinition,
  ParsedSourceFile,
} from "../core/contracts.js";
import { readText } from "../core/io.js";
import {
  analyzeDartContractDeclarations,
  analyzeEcmaContractDeclarations,
} from "./architecture-contract-declarations.js";
import type { ContractDeclarationStats, ContractStabilityFinding } from "./architecture-contract-types.js";
import { getScorableDependencies } from "./code.js";
import { classifyArchitectureLayer } from "./contract-files.js";

const INTERNAL_SIGNAL =
  /(internal|infra|infrastructure|implementation|impl|adapter|adapters|controller|controllers|logger|gateway|gateways)/i;

export interface ContractFileStats {
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

function classifyLayer(filePath: string, constraints: ArchitectureConstraints): LayerDefinition | undefined {
  return classifyArchitectureLayer(filePath, constraints);
}

function isInternalishFile(filePath: string, layerName?: string): boolean {
  return INTERNAL_SIGNAL.test(filePath) || (layerName ? INTERNAL_SIGNAL.test(layerName) : false);
}

function analyzeDeclarations(input: {
  pathValue: string;
  sourceText: string;
  parsedFile?: ParsedSourceFile;
}): ContractDeclarationStats {
  return input.parsedFile?.language === "dart"
    ? analyzeDartContractDeclarations(input.pathValue, input.sourceText)
    : analyzeEcmaContractDeclarations(input.pathValue, input.sourceText);
}

export async function analyzeContractFileStats(options: {
  root: string;
  path: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  contractFiles: Set<string>;
  fileMap: Map<string, ParsedSourceFile>;
}): Promise<ContractFileStats> {
  const sourceText = await readText(path.join(options.root, options.path));
  const parsedFile = options.fileMap.get(options.path);
  const declarationStats = analyzeDeclarations({
    pathValue: options.path,
    sourceText,
    ...(parsedFile ? { parsedFile } : {}),
  });
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

export function toContractBaselineEntry(stats: ContractFileStats): ArchitectureContractBaselineEntry {
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
