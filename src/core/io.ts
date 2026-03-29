import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { minimatch } from "minimatch";
import YAML from "yaml";

const DOCUMENT_EXTENSIONS = new Set([".md", ".adoc", ".txt"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".dart"]);
const DEFAULT_IGNORES = [
  "node_modules",
  "node_modules/**",
  "**/node_modules",
  "**/node_modules/**",
  "dist",
  "dist/**",
  "**/dist",
  "**/dist/**",
  ".git",
  ".git/**",
  "**/.git",
  "**/.git/**"
];

export function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

export function relativePath(root: string, absolutePath: string): string {
  return toPosixPath(path.relative(root, absolutePath));
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function isDocumentFile(filePath: string): boolean {
  return DOCUMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function matchGlobs(filePath: string, globs: string[] | undefined): boolean {
  if (!globs || globs.length === 0) {
    return false;
  }
  return globs.some((pattern) => minimatch(filePath, pattern, { dot: true }));
}

export async function listFiles(root: string): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relative = relativePath(root, absolutePath);
      if (DEFAULT_IGNORES.some((pattern) => minimatch(relative, pattern, { dot: true }))) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        results.push(absolutePath);
        continue;
      }
      if (entry.isSymbolicLink()) {
        try {
          const stats = await fs.stat(absolutePath);
          if (stats.isFile()) {
            results.push(absolutePath);
          }
        } catch {
          // Ignore broken or inaccessible symlinks during repository scans.
        }
      }
    }
  }

  await visit(root);
  return results.sort();
}

export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function readDataFile<T>(filePath: string): Promise<T> {
  const content = await readText(filePath);
  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return YAML.parse(content) as T;
  }
  return JSON.parse(content) as T;
}

export async function ensureDirectory(directoryPath: string): Promise<void> {
  await fs.mkdir(directoryPath, { recursive: true });
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}
