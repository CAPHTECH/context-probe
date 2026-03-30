import ts from "typescript";

import type { ArchitectureContractBaselineSymbolKind } from "../core/contracts.js";

export function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return Boolean(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

export function getDeclarationName(node: ts.Node): string | undefined {
  const namedNode = node as ts.NamedDeclaration;
  if (namedNode.name && ts.isIdentifier(namedNode.name)) {
    return namedNode.name.text;
  }
  return undefined;
}

export function isStableEcmaExport(node: ts.Node): boolean {
  return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node);
}

export function isRiskyEcmaExport(node: ts.Node): boolean {
  return (
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isVariableStatement(node) ||
    ts.isExportAssignment(node)
  );
}

export function declarationContainsAny(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  return /\bany\b/.test(node.getText(sourceFile));
}

export function getVariableDeclarationNames(node: ts.VariableStatement): string[] {
  return node.declarationList.declarations.flatMap((declaration) => {
    if (ts.isIdentifier(declaration.name)) {
      return [declaration.name.text];
    }
    return [];
  });
}

export function getEcmaExportKind(node: ts.Node): ArchitectureContractBaselineSymbolKind {
  if (ts.isInterfaceDeclaration(node)) {
    return "interface";
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return "type_alias";
  }
  return "enum";
}

export function getRiskyExportKind(node: ts.Node): ArchitectureContractBaselineSymbolKind {
  if (ts.isClassDeclaration(node)) {
    return "class";
  }
  if (ts.isFunctionDeclaration(node)) {
    return "function";
  }
  if (ts.isVariableStatement(node)) {
    return "value";
  }
  return "default_export";
}
