#!/usr/bin/env node
import process from "node:process";

import type { CommandContext } from "./core/contracts.js";
import { createResponse } from "./core/response.js";
import { COMMANDS, listCommands, maybeWriteOutput } from "./commands.js";

function parseArgs(argv: string[]): { command: string | undefined; args: Record<string, string | boolean> } {
  const [first, ...remainder] = argv;
  const command = first?.startsWith("--") ? undefined : first;
  const rest = command ? remainder : argv;
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token) {
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }
    const trimmed = token.slice(2);
    const [key, inlineValue] = trimmed.split("=", 2);
    if (!key) {
      continue;
    }
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return {
    command,
    args
  };
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));
  const context: CommandContext = {
    cwd: process.cwd()
  };

  if (!command || args.help === true) {
    process.stdout.write(
      JSON.stringify(
        createResponse({
          commands: listCommands()
        }),
        null,
        2
      ) + "\n"
    );
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const response = await handler(args, context);
    await maybeWriteOutput(response, args, context);
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    if (response.status === "error") {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const response = createResponse(
      { command },
      {
        status: "error",
        confidence: 0,
        diagnostics: [message]
      }
    );
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    process.exitCode = 1;
  }
}

void main();
