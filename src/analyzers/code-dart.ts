import path from "node:path";

import type { FileDependency, ParsedSourceFile } from "../core/contracts.js";
import {
  DART_DIRECTIVE_PATTERN,
  DART_PART_OF_PATTERN,
  type DartPackageContext,
  isGeneratedDartFile,
  type ResolveResult,
  resolveWithCandidates,
  stripComments,
} from "./code-shared.js";

function resolveDartModule(
  root: string,
  fromFile: string,
  specifier: string,
  packageContext: DartPackageContext,
): ResolveResult {
  if (specifier.startsWith("dart:")) {
    return { target: specifier, targetKind: "external" };
  }

  if (specifier.startsWith("package:")) {
    const packageMatch = /^package:([^/]+)\/(.+)$/.exec(specifier);
    if (!packageMatch) {
      return { target: specifier, targetKind: "external" };
    }
    const [, packageName, packagePath] = packageMatch;
    if (
      !packageName ||
      !packagePath ||
      !packageContext.packageName ||
      packageContext.packageName !== packageName ||
      !packageContext.packageRoot
    ) {
      return { target: specifier, targetKind: "external" };
    }
    const packageBase = path.join(packageContext.packageRoot, packagePath);
    const candidates = path.extname(packageBase) ? [packageBase] : [packageBase, `${packageBase}.dart`];
    return resolveWithCandidates(root, specifier, candidates);
  }

  if (specifier.includes(":")) {
    return { target: specifier, targetKind: "external" };
  }

  const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
  const candidates = path.extname(absoluteBase) ? [absoluteBase] : [absoluteBase, `${absoluteBase}.dart`];
  return resolveWithCandidates(root, specifier, candidates);
}

export function parseDartSourceFile(
  root: string,
  absolutePath: string,
  relative: string,
  source: string,
  packageContext: DartPackageContext,
): ParsedSourceFile {
  const sanitized = stripComments(source);
  const imports: FileDependency[] = [];
  const libraryRole: ParsedSourceFile["libraryRole"] = DART_PART_OF_PATTERN.test(sanitized) ? "part" : "library";

  for (const match of sanitized.matchAll(DART_DIRECTIVE_PATTERN)) {
    const directive = match[1];
    const specifier = match[2];
    if (!directive || !specifier) {
      continue;
    }

    const resolved = resolveDartModule(root, absolutePath, specifier, packageContext);
    imports.push({
      source: relative,
      target: resolved.target,
      specifier,
      targetKind: resolved.targetKind,
      kind: directive as FileDependency["kind"],
    });
  }

  return {
    path: relative,
    imports,
    language: "dart",
    generated: isGeneratedDartFile(relative) || libraryRole === "part",
    libraryRole,
  };
}
