import ts from "typescript";

import type { ArchitectureContractBaselineSymbol, ArchitectureContractBaselineSymbolKind } from "../core/contracts.js";
import {
  declarationContainsAny,
  getDeclarationName,
  getEcmaExportKind,
  getRiskyExportKind,
  getVariableDeclarationNames,
  hasExportModifier,
  isRiskyEcmaExport,
  isStableEcmaExport,
} from "./architecture-contract-declarations-ecma-shared.js";
import { createContractSymbol, uniqueSymbols } from "./architecture-contract-declarations-shared.js";
import type { ContractDeclarationStats, ContractStabilityFinding } from "./architecture-contract-types.js";

export function analyzeEcmaContractDeclarations(pathValue: string, sourceText: string): ContractDeclarationStats {
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
      const kind: ArchitectureContractBaselineSymbolKind = getEcmaExportKind(node);
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
    const kind: ArchitectureContractBaselineSymbolKind = getRiskyExportKind(node);

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
