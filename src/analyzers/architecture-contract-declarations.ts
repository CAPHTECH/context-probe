import ts from "typescript";

import type { ArchitectureContractBaselineSymbol, ArchitectureContractBaselineSymbolKind } from "../core/contracts.js";
import type { ContractDeclarationStats, ContractStabilityFinding } from "./architecture-contract-types.js";

const DART_CLASS_PATTERN = /^(?:(?:abstract|base|interface|final|sealed)\s+)*class\s+([A-Za-z_]\w*)\b/;
const DART_MIXIN_CLASS_PATTERN = /^(?:(?:base|abstract)\s+)*mixin\s+class\s+([A-Za-z_]\w*)\b/;
const DART_ENUM_PATTERN = /^enum\s+([A-Za-z_]\w*)\b/;
const DART_TYPEDEF_PATTERN = /^typedef\s+([A-Za-z_]\w*)\b/;
const DART_EXTENSION_TYPE_PATTERN = /^extension\s+type\s+([A-Za-z_]\w*)\b/;
const DART_FUNCTION_PATTERN = /^(?:external\s+)?(?:[A-Za-z_<>[\]?., ]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:=>|\{)/;
const DART_VALUE_PATTERN = /^(?:late\s+final|late|final|const|var|[A-Za-z_<>[\]?., ]+)\s+([A-Za-z_]\w*)\s*=/;

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

export function analyzeDartContractDeclarations(pathValue: string, sourceText: string): ContractDeclarationStats {
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
