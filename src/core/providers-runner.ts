import { execFile as execFileCallback, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { defaultProviderCommand } from "./providers-prompt.js";
import type { CliExtractionOptions } from "./providers-types.js";

const execFile = promisify(execFileCallback);

async function runCommandWithStdin(options: {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr || `Command failed with exit code ${code ?? "unknown"}`));
    });

    child.stdin.end(options.stdin);
  });
}

export async function runCodexCli(
  options: CliExtractionOptions,
  schemaPath: string,
  outputPath: string,
  prompt: string,
) {
  const command = options.providerCommand ?? defaultProviderCommand(options.provider);
  if (options.providerCommand) {
    await runCommandWithStdin({
      command,
      args: ["exec", "--skip-git-repo-check", "-C", options.cwd, "--output-schema", schemaPath, "-o", outputPath, "-"],
      cwd: options.cwd,
      stdin: prompt,
    });
  } else {
    await execFile(
      command,
      ["exec", "--skip-git-repo-check", "-C", options.cwd, "--output-schema", schemaPath, "-o", outputPath, prompt],
      {
        cwd: options.cwd,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  }
  return readFile(outputPath, "utf8");
}

export async function runClaudeCli(options: CliExtractionOptions, schema: Record<string, unknown>, prompt: string) {
  const command = options.providerCommand ?? defaultProviderCommand(options.provider);
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--permission-mode",
    "default",
    "--tools",
    "",
  ];
  const { stdout } = options.providerCommand
    ? await runCommandWithStdin({
        command,
        args: [...args, "-"],
        cwd: options.cwd,
        stdin: prompt,
      })
    : await execFile(command, [...args, prompt], {
        cwd: options.cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
  return stdout;
}
