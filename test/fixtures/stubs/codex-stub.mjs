#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const outputIndex = process.argv.indexOf("-o");
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
const prompt = process.argv[process.argv.length - 1] === "-" ? readFileSync(0, "utf8") : process.argv[process.argv.length - 1] ?? "";

if (!outputPath) {
  process.stderr.write("missing output path");
  process.exit(1);
}

let payload;
if (prompt.includes("canonical domain terms")) {
  payload = {
    items: [
      {
        canonicalTerm: "InvoiceContract",
        aliases: [],
        collision: true,
        confidence: 0.61,
        unknowns: ["Billing と Fulfillment の意味差が未確定"],
        fragmentIds: []
      }
    ],
    confidence: 0.61,
    unknowns: ["用語の意味差レビューが必要"],
    diagnostics: []
  };
} else if (prompt.includes("business rules")) {
  payload = {
    items: [
      {
        type: "business_rule",
        statement: "注文確定後は決済総額と明細合計が常に一致していなければならない",
        confidence: 0.72,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["注文", "決済", "明細"]
      }
    ],
    confidence: 0.72,
    unknowns: [],
    diagnostics: []
  };
} else {
  payload = {
    items: [
      {
        type: "strong_invariant",
        statement: "注文確定後は決済総額と明細合計が常に一致していなければならない",
        confidence: 0.69,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["注文", "決済", "明細"]
      }
    ],
    confidence: 0.69,
    unknowns: [],
    diagnostics: []
  };
}

writeFileSync(outputPath, JSON.stringify(payload), "utf8");
