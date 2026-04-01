import { promises as fs } from "node:fs";
import { readAndSummarizeCommandEventLog } from "../../src/core/command-analytics.js";

function parseArgs(argv: string[]): { input?: string } {
  const result: { input?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") {
      const value = argv[index + 1];
      if (value) {
        result.input = value;
      }
      index += 1;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ?? process.env.CONTEXT_PROBE_EVENT_LOG;
  if (!inputPath) {
    throw new Error("`--input` or CONTEXT_PROBE_EVENT_LOG is required");
  }
  await fs.access(inputPath);
  const summary = await readAndSummarizeCommandEventLog(inputPath);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

void main();
