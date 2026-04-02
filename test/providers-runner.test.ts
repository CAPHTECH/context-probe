import { chmod } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runClaudeCli } from "../src/core/providers-runner.js";
import type { CliExtractionOptions } from "../src/core/providers-types.js";

const OVERFLOW_STUB = path.resolve("test/fixtures/stubs/overflow-stub.mjs");
const PREVIOUS_OVERFLOW_BYTES = process.env.CONTEXT_PROBE_OVERFLOW_BYTES;
const PREVIOUS_OVERFLOW_CHANNEL = process.env.CONTEXT_PROBE_OVERFLOW_CHANNEL;

describe("provider runner", () => {
  beforeAll(async () => {
    await chmod(OVERFLOW_STUB, 0o755);
  });

  afterAll(async () => {
    if (PREVIOUS_OVERFLOW_BYTES === undefined) {
      delete process.env.CONTEXT_PROBE_OVERFLOW_BYTES;
    } else {
      process.env.CONTEXT_PROBE_OVERFLOW_BYTES = PREVIOUS_OVERFLOW_BYTES;
    }
    if (PREVIOUS_OVERFLOW_CHANNEL === undefined) {
      delete process.env.CONTEXT_PROBE_OVERFLOW_CHANNEL;
    } else {
      process.env.CONTEXT_PROBE_OVERFLOW_CHANNEL = PREVIOUS_OVERFLOW_CHANNEL;
    }
  });

  test("rejects providerCommand output that exceeds the max buffer", async () => {
    process.env.CONTEXT_PROBE_OVERFLOW_BYTES = String(11 * 1024 * 1024);
    process.env.CONTEXT_PROBE_OVERFLOW_CHANNEL = "stdout";

    const options: CliExtractionOptions = {
      cwd: process.cwd(),
      provider: "claude",
      providerCommand: OVERFLOW_STUB,
      kind: "glossary",
      promptProfile: "default",
      fragments: [],
    };

    await expect(runClaudeCli(options, {}, "prompt")).rejects.toThrow(/maxBuffer/i);
  });
});
