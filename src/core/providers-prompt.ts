import type { ExtractionKind, Fragment } from "./contracts.js";

export function defaultProviderCommand(provider: "codex" | "claude"): string {
  return provider === "codex" ? "codex" : "claude";
}

export function buildPrompt(kind: ExtractionKind, promptProfile: string, fragments: Fragment[]): string {
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

export function buildSchema(kind: ExtractionKind): Record<string, unknown> {
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
