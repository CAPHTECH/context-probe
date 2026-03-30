import path from "node:path";

import type { CodebaseAnalysis } from "../core/contracts.js";
import { listFiles, readText, relativePath } from "../core/io.js";

export { detectBoundaryLeaks, detectContractUsage, getScorableDependencies } from "./code-contracts.js";

import { parseDartSourceFile } from "./code-dart.js";
import { parseEcmaSourceFile } from "./code-ecma.js";
import { DART_EXTENSION, ECMASCRIPT_EXTENSIONS, isDartSourceFile, loadDartPackageContext } from "./code-shared.js";

export async function parseCodebase(root: string): Promise<CodebaseAnalysis> {
  const dartPackageContext = await loadDartPackageContext(root);
  const absoluteFiles = (await listFiles(root)).filter((filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    return ECMASCRIPT_EXTENSIONS.has(extension) || extension === DART_EXTENSION;
  });

  const files = [];
  const dependencies = [];

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
    scorableSourceFiles,
  };
}
