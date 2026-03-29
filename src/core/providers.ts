import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ExtractionKind, ExtractionProviderName, ExtractionProviderResult, Fragment } from "./contracts.js";

const execFile = promisify(execFileCallback);

type RawProviderItem = Record<string, unknown>;

export interface CliExtractionOptions {
  cwd: string;
  provider: ExtractionProviderName;
  providerCommand?: string;
  kind: ExtractionKind;
  promptProfile: string;
  fragments: Fragment[];
}

function defaultProviderCommand(provider: ExtractionProviderName): string {
  return provider === "codex" ? "codex" : "claude";
}

function buildPrompt(kind: ExtractionKind, promptProfile: string, fragments: Fragment[]): string {
  const instructions = {
    glossary:
      "Extract canonical domain terms, aliases, collision risk, confidence, unknowns, and supporting fragmentIds.",
    rules:
      "Extract business rules with type, statement, confidence, unknowns, relatedTerms, and supporting fragmentIds.",
    invariants:
      "Extract invariants with type, statement, confidence, unknowns, relatedTerms, and supporting fragmentIds.",
  } satisfies Record<ExtractionKind, string>;

  const fragmentsBlock = fragments
    .map((fragment) => `- fragmentId=${fragment.fragmentId} path=${fragment.path}\n${fragment.text}`)
    .join("\n\n");

  return [
    "Return JSON only.",
    instructions[kind],
    `Prompt profile: ${promptProfile}`,
    "Use only the provided fragments as evidence.",
    "If uncertain, keep unknowns non-empty instead of guessing.",
    "",
    "Fragments:",
    fragmentsBlock,
  ].join("\n");
}

function buildSchema(kind: ExtractionKind): Record<string, unknown> {
  const baseItem =
    kind === "glossary"
      ? {
          type: "object",
          properties: {
            canonicalTerm: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            collision: { type: "boolean" },
            confidence: { type: "number" },
            unknowns: { type: "array", items: { type: "string" } },
            fragmentIds: { type: "array", items: { type: "string" } },
          },
          required: ["canonicalTerm", "aliases", "collision", "confidence", "unknowns", "fragmentIds"],
        }
      : {
          type: "object",
          properties: {
            type: { type: "string" },
            statement: { type: "string" },
            confidence: { type: "number" },
            unknowns: { type: "array", items: { type: "string" } },
            fragmentIds: { type: "array", items: { type: "string" } },
            relatedTerms: { type: "array", items: { type: "string" } },
          },
          required: ["type", "statement", "confidence", "unknowns", "fragmentIds", "relatedTerms"],
        };

  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: baseItem,
      },
      confidence: { type: "number" },
      unknowns: { type: "array", items: { type: "string" } },
      diagnostics: { type: "array", items: { type: "string" } },
    },
    required: ["items", "confidence", "unknowns", "diagnostics"],
  };
}

function normalizeProviderPayload(payload: unknown): {
  items: RawProviderItem[];
  confidence: number;
  unknowns: string[];
  diagnostics: string[];
} {
  if (Array.isArray(payload)) {
    return {
      items: payload.filter((value): value is RawProviderItem => typeof value === "object" && value !== null),
      confidence: 0.7,
      unknowns: [],
      diagnostics: [],
    };
  }
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const nested =
      record.result && typeof record.result === "object" ? (record.result as Record<string, unknown>) : record;
    return {
      items: Array.isArray(nested.items)
        ? nested.items.filter((value): value is RawProviderItem => typeof value === "object" && value !== null)
        : [],
      confidence: typeof nested.confidence === "number" ? nested.confidence : 0.7,
      unknowns: Array.isArray(nested.unknowns)
        ? nested.unknowns.filter((value): value is string => typeof value === "string")
        : [],
      diagnostics: Array.isArray(nested.diagnostics)
        ? nested.diagnostics.filter((value): value is string => typeof value === "string")
        : [],
    };
  }
  throw new Error("Provider output was not a JSON object");
}

async function runCodexCli(options: CliExtractionOptions, schemaPath: string, outputPath: string, prompt: string) {
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

async function runClaudeCli(options: CliExtractionOptions, schema: Record<string, unknown>, prompt: string) {
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
