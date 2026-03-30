import type { RawProviderItem } from "./providers-types.js";

export function normalizeProviderPayload(payload: unknown): {
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
