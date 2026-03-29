import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { parseCodebase } from "../src/analyzers/code.js";
import { listFiles } from "../src/core/io.js";

describe("listFiles", () => {
  let tempRoot: string | undefined;

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  test("skips symlinked directories even when they look like source files", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-io-"));

    const sourceFile = path.join(tempRoot, "src", "index.ts");
    const targetDirectory = path.join(tempRoot, "packages", "actual");
    const misleadingSymlink = path.join(tempRoot, "packages", "ipaddr.js");

    await mkdir(path.dirname(sourceFile), { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(sourceFile, 'export const value = 1;\n', "utf8");
    await writeFile(path.join(targetDirectory, "nested.txt"), "not a source file\n", "utf8");
    await symlink(targetDirectory, misleadingSymlink, "dir");

    const files = await listFiles(tempRoot);
    const relativeFiles = files.map((filePath) => path.relative(tempRoot!, filePath).replace(/\\/g, "/"));

    expect(relativeFiles).toContain("src/index.ts");
    expect(relativeFiles).not.toContain("packages/ipaddr.js");

    const codebase = await parseCodebase(tempRoot);
    expect(codebase.files.map((file) => file.path)).toEqual(["src/index.ts"]);
  });

  test("skips nested node_modules and dist trees during repository scans", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-io-"));

    const sourceFile = path.join(tempRoot, "src", "index.ts");
    const nestedNodeModulesFile = path.join(
      tempRoot,
      "apps",
      "tooling",
      "node_modules",
      "example-package",
      "index.ts"
    );
    const nestedDistFile = path.join(tempRoot, "apps", "tooling", "dist", "generated.js");

    await mkdir(path.dirname(sourceFile), { recursive: true });
    await mkdir(path.dirname(nestedNodeModulesFile), { recursive: true });
    await mkdir(path.dirname(nestedDistFile), { recursive: true });
    await writeFile(sourceFile, 'export const value = 1;\n', "utf8");
    await writeFile(nestedNodeModulesFile, 'export const vendored = true;\n', "utf8");
    await writeFile(nestedDistFile, 'export const generated = true;\n', "utf8");

    const files = await listFiles(tempRoot);
    const relativeFiles = files.map((filePath) => path.relative(tempRoot!, filePath).replace(/\\/g, "/"));

    expect(relativeFiles).toContain("src/index.ts");
    expect(relativeFiles).not.toContain("apps/tooling/node_modules/example-package/index.ts");
    expect(relativeFiles).not.toContain("apps/tooling/dist/generated.js");

    const codebase = await parseCodebase(tempRoot);
    expect(codebase.files.map((file) => file.path)).toEqual(["src/index.ts"]);
  });
});
