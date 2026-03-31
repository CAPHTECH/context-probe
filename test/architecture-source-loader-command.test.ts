import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test } from "vitest";

import { resolveCommandSourceConfig } from "../src/analyzers/architecture-source-loader-command.js";

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

test("resolveCommandSourceConfig accepts large JSON stdout without exec buffer limits", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-command-source-"));
  tempPaths.push(tempRoot);

  const scriptPath = path.join(tempRoot, "emit-large.mjs");
  await writeFile(
    scriptPath,
    `const payload = {
  version: "1.0",
  bands: [],
  blob: "a".repeat(${11 * 1024 * 1024}),
};
process.stdout.write(JSON.stringify(payload));
`,
    "utf8",
  );

  const resolved = await resolveCommandSourceConfig<{ version: string; bands: unknown[]; blob: string }>({
    config: {
      version: "1.0",
      sourceType: "command",
      cwd: tempRoot,
      command: `${shellQuote(process.execPath)} ${shellQuote(scriptPath)}`,
    },
    configPath: path.join(tempRoot, "telemetry-source.command.json"),
    label: "telemetry",
  });

  expect(resolved.data.version).toBe("1.0");
  expect(resolved.data.bands).toEqual([]);
  expect(resolved.data.blob).toHaveLength(11 * 1024 * 1024);
});
