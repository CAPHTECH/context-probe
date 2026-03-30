import path from "node:path";

import ts from "typescript";

import type { FileDependency, ParsedSourceFile } from "../core/contracts.js";
import { inferSourceLanguage, type ResolveResult, resolveWithCandidates } from "./code-shared.js";

function resolveEcmaModule(root: string, fromFile: string, specifier: string): ResolveResult {
  if (!specifier.startsWith(".")) {
    return { target: specifier, targetKind: "external" };
  }

  const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
  const extension = path.extname(absoluteBase).toLowerCase();
  const withoutExtension = extension ? absoluteBase.slice(0, -extension.length) : absoluteBase;
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.js`,
    `${absoluteBase}.jsx`,
    path.join(absoluteBase, "index.ts"),
    path.join(absoluteBase, "index.tsx"),
    path.join(absoluteBase, "index.js"),
    path.join(absoluteBase, "index.jsx"),
  ];

  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") {
    candidates.push(
      `${withoutExtension}.ts`,
      `${withoutExtension}.tsx`,
      `${withoutExtension}.mts`,
      `${withoutExtension}.cts`,
      path.join(withoutExtension, "index.ts"),
      path.join(withoutExtension, "index.tsx"),
      path.join(withoutExtension, "index.mts"),
      path.join(withoutExtension, "index.cts"),
    );
  }

  return resolveWithCandidates(root, specifier, candidates);
}

export function parseEcmaSourceFile(
  root: string,
  absolutePath: string,
  relative: string,
  source: string,
): ParsedSourceFile {
  const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.ES2022, true);
  const imports: FileDependency[] = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) {
      return;
    }
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
      return;
    }

    const specifier = node.moduleSpecifier.text;
    const resolved = resolveEcmaModule(root, absolutePath, specifier);
    imports.push({
      source: relative,
      target: resolved.target,
      specifier,
      targetKind: resolved.targetKind,
      kind: ts.isImportDeclaration(node) ? "import" : "export",
    });
  });

  return {
    path: relative,
    imports,
    language: inferSourceLanguage(relative),
    generated: false,
  };
}
