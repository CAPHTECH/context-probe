import { execFile as execFileCallback, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { defaultProviderCommand } from "./providers-prompt.js";
import type { CliExtractionOptions } from "./providers-types.js";

const execFile = promisify(execFileCallback);
const MAX_COMMAND_BUFFER_BYTES = 10 * 1024 * 1024;

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
    let bufferedBytes = 0;
    let settled = false;

    const cleanup = () => {
      child.stdout.removeListener("data", onStdoutData);
      child.stderr.removeListener("data", onStderrData);
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
    };

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const resolveOnce = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({ stdout, stderr });
    };

    const appendChunk = (streamName: "stdout" | "stderr", chunk: Buffer | string) => {
      if (settled) {
        return;
      }
      bufferedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
      if (bufferedBytes > MAX_COMMAND_BUFFER_BYTES) {
        child.kill();
        rejectOnce(new Error(`Command output exceeded maxBuffer of ${MAX_COMMAND_BUFFER_BYTES} bytes`));
        return;
      }
      const text = chunk.toString();
      if (streamName === "stdout") {
        stdout += text;
        return;
      }
      stderr += text;
    };

    const onStdoutData = (chunk: Buffer | string) => {
      appendChunk("stdout", chunk);
    };

    const onStderrData = (chunk: Buffer | string) => {
      appendChunk("stderr", chunk);
    };

    const onError = (error: Error) => {
      rejectOnce(error);
    };

    const onClose = (code: number | null) => {
      if (settled) {
        return;
      }
      if (code === 0) {
        resolveOnce();
        return;
      }
      rejectOnce(new Error(stderr || `Command failed with exit code ${code ?? "unknown"}`));
    };

    child.stdout.on("data", onStdoutData);
    child.stderr.on("data", onStderrData);
    child.on("error", onError);
    child.on("close", onClose);

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
        maxBuffer: MAX_COMMAND_BUFFER_BYTES,
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
        maxBuffer: MAX_COMMAND_BUFFER_BYTES,
      });
  return stdout;
}
