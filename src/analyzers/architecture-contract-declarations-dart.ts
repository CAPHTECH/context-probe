import type { ArchitectureContractBaselineSymbol, ArchitectureContractBaselineSymbolKind } from "../core/contracts.js";
import { createContractSymbol, uniqueSymbols } from "./architecture-contract-declarations-shared.js";
import type { ContractDeclarationStats, ContractStabilityFinding } from "./architecture-contract-types.js";

const DART_CLASS_PATTERN = /^(?:(?:abstract|base|interface|final|sealed)\s+)*class\s+([A-Za-z_]\w*)\b/;
const DART_MIXIN_CLASS_PATTERN = /^(?:(?:base|abstract)\s+)*mixin\s+class\s+([A-Za-z_]\w*)\b/;
const DART_ENUM_PATTERN = /^enum\s+([A-Za-z_]\w*)\b/;
const DART_TYPEDEF_PATTERN = /^typedef\s+([A-Za-z_]\w*)\b/;
const DART_EXTENSION_TYPE_PATTERN = /^extension\s+type\s+([A-Za-z_]\w*)\b/;
const DART_FUNCTION_PATTERN = /^(?:external\s+)?(?:[A-Za-z_<>[\]?., ]+\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:=>|\{)/;
const DART_VALUE_PATTERN = /^(?:late\s+final|late|final|const|var|[A-Za-z_<>[\]?., ]+)\s+([A-Za-z_]\w*)\s*=/;

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
