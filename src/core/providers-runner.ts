import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { defaultProviderCommand } from "./providers-prompt.js";
import type { CliExtractionOptions } from "./providers-types.js";

const execFile = promisify(execFileCallback);

export async function runCodexCli(
  options: CliExtractionOptions,
  schemaPath: string,
  outputPath: string,
  prompt: string,
) {
  const command = options.providerCommand ?? defaultProviderCommand(options.provider);
  await execFile(
    command,
    ["exec", "--skip-git-repo-check", "-C", options.cwd, "--output-schema", schemaPath, "-o", outputPath, prompt],
    {
      cwd: options.cwd,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return readFile(outputPath, "utf8");
}

export async function runClaudeCli(options: CliExtractionOptions, schema: Record<string, unknown>, prompt: string) {
  const command = options.providerCommand ?? defaultProviderCommand(options.provider);
  const { stdout } = await execFile(
    command,
    [
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      "--permission-mode",
      "default",
      "--tools",
      "",
      prompt,
    ],
    {
      cwd: options.cwd,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout;
}
