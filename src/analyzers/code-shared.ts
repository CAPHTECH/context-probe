import path from "node:path";

import ts from "typescript";

import type { FileDependency, ParsedSourceFile } from "../core/contracts.js";
import { readDataFile, relativePath } from "../core/io.js";

export const ECMASCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);
export const DART_EXTENSION = ".dart";
const DART_GENERATED_SUFFIXES = [".g.dart", ".freezed.dart", ".mocks.dart", ".gen.dart", ".gr.dart"];
export const DART_DIRECTIVE_PATTERN = /^\s*(import|export|part)\s+(?!of\b)[^"'`]*["']([^"']+)["'][^;]*;/gm;
export const DART_PART_OF_PATTERN = /^\s*part\s+of\b/m;

export interface ResolveResult {
  target: string;
  targetKind: FileDependency["targetKind"];
}

export interface DartPackageContext {
  packageName?: string;
  packageRoot?: string;
}

function fileExists(filePath: string): boolean {
  return ts.sys.fileExists(filePath);
}

export function isDartSourceFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === DART_EXTENSION;
}

export function inferSourceLanguage(filePath: string): ParsedSourceFile["language"] {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === DART_EXTENSION) {
    return "dart";
  }
  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") {
    return "javascript";
  }
  return "typescript";
}

export function isGeneratedDartFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return DART_GENERATED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

export function resolveWithCandidates(root: string, specifier: string, candidates: string[]): ResolveResult {
  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return {
        target: relativePath(root, candidate),
        targetKind: "file",
      };
    }
  }

  return {
    target: specifier,
    targetKind: "missing",
  };
}

export async function loadDartPackageContext(root: string): Promise<DartPackageContext> {
  const pubspecPath = path.join(root, "pubspec.yaml");
  if (!fileExists(pubspecPath)) {
    return {};
  }

  try {
    const pubspec = await readDataFile<{ name?: string }>(pubspecPath);
    if (typeof pubspec.name !== "string" || pubspec.name.trim().length === 0) {
      return {};
    }
    return {
      packageName: pubspec.name.trim(),
      packageRoot: path.join(root, "lib"),
    };
  } catch {
    return {};
  }
}
