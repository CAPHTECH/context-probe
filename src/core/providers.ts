import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ExtractionProviderResult } from "./contracts.js";
import { normalizeProviderPayload } from "./providers-normalization.js";
import { buildPrompt, buildSchema } from "./providers-prompt.js";
import { runClaudeCli, runCodexCli } from "./providers-runner.js";

export type { CliExtractionOptions } from "./providers-types.js";

import type { CliExtractionOptions, RawProviderItem } from "./providers-types.js";

export async function runCliExtraction(
  options: CliExtractionOptions,
): Promise<ExtractionProviderResult<RawProviderItem>> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-provider-"));
  const schemaPath = path.join(tempDir, `${options.kind}-schema.json`);
  const outputPath = path.join(tempDir, `${options.kind}-output.json`);
  const schema = buildSchema(options.kind);
  const prompt = buildPrompt(options.kind, options.promptProfile, options.fragments);
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  try {
    const rawOutput =
      options.provider === "codex"
        ? await runCodexCli(options, schemaPath, outputPath, prompt)
        : await runClaudeCli(options, schema, prompt);
    const parsed = normalizeProviderPayload(JSON.parse(rawOutput));
    return {
      items: parsed.items,
      confidence: parsed.confidence,
      unknowns: parsed.unknowns,
      diagnostics: parsed.diagnostics,
      provider: options.provider,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
