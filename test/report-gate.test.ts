import { describe } from "vitest";

import { registerReportGateEvaluationTests } from "./report-gate-evaluation.js";
import { registerReportMarkdownTests } from "./report-markdown.js";

describe("report and gate", () => {
  registerReportMarkdownTests();
  registerReportGateEvaluationTests();
});
