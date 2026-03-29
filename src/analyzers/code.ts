import path from "node:path";

import ts from "typescript";

import type {
  BoundaryLeakFinding,
  CodebaseAnalysis,
  ContractUsageReport,
  DomainModel,
  FileDependency,
  ParsedSourceFile
} from "../core/contracts.js";
import { matchGlobs, listFiles, readDataFile, readText, relativePath } from "../core/io.js";

const ECMASCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);
const DART_EXTENSION = ".dart";
const DART_GENERATED_SUFFIXES = [".g.dart", ".freezed.dart", ".mocks.dart", ".gen.dart", ".gr.dart"];
const DART_DIRECTIVE_PATTERN = /^\s*(import|export|part)\s+(?!of\b)[^"'`]*["']([^"']+)["'][^;]*;/gm;
const DART_PART_OF_PATTERN = /^\s*part\s+of\b/m;

interface ResolveResult {
  target: string;
  targetKind: FileDependency["targetKind"];
}

interface DartPackageContext {
  packageName?: string;
  packageRoot?: string;
}

function fileExists(filePath: string): boolean {
  return ts.sys.fileExists(filePath);
}

function isDartSourceFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === DART_EXTENSION;
}

function inferSourceLanguage(filePath: string): ParsedSourceFile["language"] {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === DART_EXTENSION) {
    return "dart";
  }
  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") {
    return "javascript";
  }
  return "typescript";
}

function isGeneratedDartFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return DART_GENERATED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function resolveWithCandidates(root: string, specifier: string, candidates: string[]): ResolveResult {
  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return {
        target: relativePath(root, candidate),
        targetKind: "file"
      };
    }
  }

  return {
    target: specifier,
    targetKind: "missing"
  };
}

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
    path.join(absoluteBase, "index.jsx")
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
      path.join(withoutExtension, "index.cts")
    );
  }

  return resolveWithCandidates(root, specifier, candidates);
}

async function loadDartPackageContext(root: string): Promise<DartPackageContext> {
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
      packageRoot: path.join(root, "lib")
    };
  } catch {
    return {};
  }
}

function resolveDartModule(
  root: string,
  fromFile: string,
  specifier: string,
  packageContext: DartPackageContext
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
    const candidates = path.extname(packageBase)
      ? [packageBase]
      : [packageBase, `${packageBase}.dart`];
    return resolveWithCandidates(root, specifier, candidates);
  }

  if (specifier.includes(":")) {
    return { target: specifier, targetKind: "external" };
  }

  const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
  const candidates = path.extname(absoluteBase)
    ? [absoluteBase]
    : [absoluteBase, `${absoluteBase}.dart`];
  return resolveWithCandidates(root, specifier, candidates);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function parseEcmaSourceFile(root: string, absolutePath: string, relative: string, source: string): ParsedSourceFile {
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
      kind: ts.isImportDeclaration(node) ? "import" : "export"
    });
  });

  return {
    path: relative,
    imports,
    language: inferSourceLanguage(relative),
    generated: false
  };
}

function parseDartSourceFile(
  root: string,
  absolutePath: string,
  relative: string,
  source: string,
  packageContext: DartPackageContext
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
      kind: directive as FileDependency["kind"]
    });
  }

  return {
    path: relative,
    imports,
    language: "dart",
    generated: isGeneratedDartFile(relative) || libraryRole === "part",
    libraryRole
  };
}

export async function parseCodebase(root: string): Promise<CodebaseAnalysis> {
  const dartPackageContext = await loadDartPackageContext(root);
  const absoluteFiles = (await listFiles(root)).filter((filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    return ECMASCRIPT_EXTENSIONS.has(extension) || extension === DART_EXTENSION;
  });

  const files: ParsedSourceFile[] = [];
  const dependencies: FileDependency[] = [];

  for (const absolutePath of absoluteFiles) {
    const relative = relativePath(root, absolutePath);
    const source = await readText(absolutePath);
    const parsedFile = isDartSourceFile(relative)
      ? parseDartSourceFile(root, absolutePath, relative, source, dartPackageContext)
      : parseEcmaSourceFile(root, absolutePath, relative, source);

    files.push(parsedFile);
    dependencies.push(...parsedFile.imports);
  }

  const sourceFiles = files.map((file) => file.path);
  const scorableSourceFiles = files
    .filter((file) => !file.generated && file.libraryRole !== "part")
    .map((file) => file.path);

  return {
    files,
    dependencies,
    sourceFiles,
    scorableSourceFiles
  };
}

export function getScorableDependencies(codebase: CodebaseAnalysis): FileDependency[] {
  const scorableSources = new Set(codebase.scorableSourceFiles);
  return codebase.dependencies.filter((dependency) => scorableSources.has(dependency.source));
}

function classifyContext(
  filePath: string,
  model: DomainModel
): { context?: string; classification: "contract" | "internal" | "unclassified" } {
  for (const context of model.contexts) {
    if (!matchGlobs(filePath, context.pathGlobs)) {
      continue;
    }
    if (matchGlobs(filePath, context.contractGlobs)) {
      return { context: context.name, classification: "contract" };
    }
    if (matchGlobs(filePath, context.internalGlobs)) {
      return { context: context.name, classification: "internal" };
    }
    return { context: context.name, classification: "unclassified" };
  }
  return { classification: "unclassified" };
}

export function detectContractUsage(
  codebase: CodebaseAnalysis,
  model: DomainModel
): ContractUsageReport {
  let applicableReferences = 0;
  let compliantReferences = 0;
  const findings: ContractUsageReport["findings"] = [];

  for (const dependency of getScorableDependencies(codebase).filter((entry) => entry.targetKind === "file")) {
    const sourceInfo = classifyContext(dependency.source, model);
    const targetInfo = classifyContext(dependency.target, model);
    if (!sourceInfo.context || !targetInfo.context || sourceInfo.context === targetInfo.context) {
      continue;
    }
    applicableReferences += 1;
    if (targetInfo.classification === "contract") {
      compliantReferences += 1;
    }
    findings.push({
      source: dependency.source,
      target: dependency.target,
      sourceContext: sourceInfo.context,
      targetContext: targetInfo.context,
      targetClassification: targetInfo.classification
    });
  }

  return {
    adherence: applicableReferences === 0 ? 1 : compliantReferences / applicableReferences,
    applicableReferences,
    compliantReferences,
    findings
  };
}

export function detectBoundaryLeaks(
  codebase: CodebaseAnalysis,
  model: DomainModel
): BoundaryLeakFinding[] {
  const findings: BoundaryLeakFinding[] = [];

  for (const dependency of getScorableDependencies(codebase).filter((entry) => entry.targetKind === "file")) {
    const sourceInfo = classifyContext(dependency.source, model);
    const targetInfo = classifyContext(dependency.target, model);
    if (!sourceInfo.context || !targetInfo.context || sourceInfo.context === targetInfo.context) {
      continue;
    }
    if (targetInfo.classification !== "internal") {
      continue;
    }
    findings.push({
      findingId: `BL-${dependency.source.replace(/[^A-Za-z0-9]/g, "").slice(-8)}-${findings.length + 1}`,
      severity: "high",
      sourceContext: sourceInfo.context,
      targetContext: targetInfo.context,
      violationType: "direct_internal_type_reference",
      sourceSymbol: path.basename(dependency.source),
      targetSymbol: path.basename(dependency.target),
      path: dependency.source
    });
  }

  return findings;
}
