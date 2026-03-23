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
        unknowns: ["The meaning difference between Billing and Fulfillment is not yet resolved."],
        fragmentIds: []
      }
    ],
    confidence: 0.61,
    unknowns: ["A review is needed to resolve the meaning difference between terms."],
    diagnostics: []
  };
} else if (prompt.includes("business rules")) {
  payload = {
    items: [
      {
        type: "business_rule",
        statement: "After order confirmation, the payment total and line-item total must always match.",
        confidence: 0.72,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["Order", "Payment", "LineItem"]
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
        statement: "After order confirmation, the payment total and line-item total must always match.",
        confidence: 0.69,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["Order", "Payment", "LineItem"]
      }
    ],
    confidence: 0.69,
    unknowns: [],
    diagnostics: []
  };
}

writeFileSync(outputPath, JSON.stringify(payload), "utf8");
