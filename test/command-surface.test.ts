import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { listCommands, maybeWriteOutput } from "../src/commands.js";
import { createResponse } from "../src/core/response.js";
import { CONTEXT, withTemporaryDirectory } from "./command-surface.helpers.js";

describe("command surface", () => {
  test("listCommands includes sorted domain and architecture command families", () => {
    const commands = listCommands();

    expect(commands).toEqual([...commands].sort());
    expect(commands).toContain("ingest.register_artifacts");
    expect(commands).toContain("trace.link_model_to_code");
    expect(commands).toContain("arch.load_topology");
    expect(commands).toContain("score.compute");
  });

  test("maybeWriteOutput persists a command response only when output is requested", async () => {
    await withTemporaryDirectory("context-probe-command-output-", async (tempDir) => {
      const outputPath = path.join(tempDir, "response.json");
      const response = createResponse({ saved: true });

      await maybeWriteOutput(response, { output: outputPath }, CONTEXT);

      const saved = JSON.parse(await readFile(outputPath, "utf8"));
      expect(saved).toEqual(response);

      const untouchedPath = path.join(tempDir, "untouched.json");
      await maybeWriteOutput(response, {}, CONTEXT);
      await expect(readFile(untouchedPath, "utf8")).rejects.toThrow();
    });
  });
});
