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
import { matchGlobs, listFiles, readText, relativePath } from "../core/io.js";

function resolveImport(root: string, fromFile: string, specifier: string): { target: string; targetKind: FileDependency["targetKind"] } {
  if (!specifier.startsWith(".")) {
    return { target: specifier, targetKind: "external" };
  }

  const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
  const extension = path.extname(absoluteBase);
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

  for (const candidate of candidates) {
    if (ts.sys.fileExists(candidate)) {
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

export async function parseCodebase(root: string): Promise<CodebaseAnalysis> {
  const absoluteFiles = (await listFiles(root)).filter((filePath) =>
    [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].includes(path.extname(filePath))
  );

  const files: ParsedSourceFile[] = [];
  const dependencies: FileDependency[] = [];

  for (const absolutePath of absoluteFiles) {
    const relative = relativePath(root, absolutePath);
    const source = await readText(absolutePath);
    const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.ES2022, true);
    const imports: FileDependency[] = [];

    sourceFile.forEachChild((node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const resolved = resolveImport(root, absolutePath, specifier);
        imports.push({
          source: relative,
          target: resolved.target,
          specifier,
          targetKind: resolved.targetKind
        });
      }
    });

    files.push({
      path: relative,
      imports
    });
    dependencies.push(...imports);
  }

  return {
    files,
    dependencies,
    sourceFiles: files.map((file) => file.path)
  };
}

function classifyContext(filePath: string, model: DomainModel): { context?: string; classification: "contract" | "internal" | "unclassified" } {
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

  for (const dependency of codebase.dependencies.filter((entry) => entry.targetKind === "file")) {
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

  for (const dependency of codebase.dependencies.filter((entry) => entry.targetKind === "file")) {
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
