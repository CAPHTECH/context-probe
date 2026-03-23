import path from "node:path";

import type { Artifact, Fragment } from "./contracts.js";
import { hashText, isDocumentFile, isSourceFile, listFiles, readText, relativePath } from "./io.js";

function inferArtifactType(filePath: string): Artifact["type"] {
  if (isDocumentFile(filePath)) {
    return "document";
  }
  if (isSourceFile(filePath)) {
    return "source_code";
  }
  if (filePath.endsWith(".json") || filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return "config";
  }
  return "unknown";
}

export async function registerArtifacts(root: string): Promise<Artifact[]> {
  const files = await listFiles(root);
  const artifacts: Artifact[] = [];
  for (const filePath of files) {
    const content = await readText(filePath);
    artifacts.push({
      artifactId: `ART-${hashText(`${filePath}:${content}`).slice(0, 8)}`,
      type: inferArtifactType(filePath),
      path: relativePath(root, filePath),
      size: content.length,
      hash: hashText(content),
      collectedAt: new Date().toISOString()
    });
  }
  return artifacts;
}

export async function normalizeDocuments(root: string): Promise<Fragment[]> {
  const files = await listFiles(root);
  const fragments: Fragment[] = [];

  for (const filePath of files.filter((filePath) => isDocumentFile(filePath) && !filePath.toLowerCase().endsWith(".ja.md"))) {
    const content = await readText(filePath);
    const relative = relativePath(root, filePath);
    const paragraphs = content
      .split(/\n\s*\n/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

    let searchCursor = 0;
    for (const paragraph of paragraphs) {
      const startIndex = content.indexOf(paragraph, searchCursor);
      const lineStart = content.slice(0, Math.max(0, startIndex)).split("\n").length;
      const lineEnd = lineStart + paragraph.split("\n").length - 1;
      searchCursor = startIndex + paragraph.length;

      fragments.push({
        fragmentId: `FRG-${hashText(`${relative}:${paragraph}`).slice(0, 10)}`,
        artifactId: `ART-${hashText(`${relative}:${content}`).slice(0, 8)}`,
        kind: paragraph.startsWith("#") ? "heading" : "paragraph",
        text: paragraph,
        path: relative,
        lineStart,
        lineEnd
      });
    }
  }

  return fragments.sort((left, right) => left.path.localeCompare(right.path));
}

export function resolveOutputPath(root: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(root, filePath);
}
