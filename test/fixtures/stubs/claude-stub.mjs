#!/usr/bin/env node
import { readFileSync } from "node:fs";

const prompt = process.argv[process.argv.length - 1] === "-" ? readFileSync(0, "utf8") : process.argv[process.argv.length - 1] ?? "";

let payload;
if (prompt.includes("canonical domain terms")) {
  payload = {
    items: [
      {
        canonicalTerm: "InvoiceContract",
        aliases: ["Invoice"],
        collision: false,
        confidence: 0.8,
        unknowns: [],
        fragmentIds: []
      }
    ],
    confidence: 0.8,
    unknowns: [],
    diagnostics: []
  };
} else {
  payload = {
    items: [
      {
        type: "business_rule",
        statement: "After order confirmation, the payment total and line-item total must always match.",
        confidence: 0.74,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["Order", "Payment", "LineItem"]
      }
    ],
    confidence: 0.74,
    unknowns: [],
    diagnostics: []
  };
}

process.stdout.write(`${JSON.stringify(payload)}\n`);
