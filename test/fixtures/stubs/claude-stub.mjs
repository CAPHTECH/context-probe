#!/usr/bin/env node
const prompt = process.argv[process.argv.length - 1] ?? "";

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
        statement: "注文確定後は決済総額と明細合計が常に一致していなければならない",
        confidence: 0.74,
        unknowns: [],
        fragmentIds: [],
        relatedTerms: ["注文", "決済", "明細"]
      }
    ],
    confidence: 0.74,
    unknowns: [],
    diagnostics: []
  };
}

process.stdout.write(`${JSON.stringify(payload)}\n`);
