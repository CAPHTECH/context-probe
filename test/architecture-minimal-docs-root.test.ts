import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { getMetric } from "./architecture-collector-scripts.helpers.js";
import { SCAFFOLD_AUTODISCOVERY_DOCS_ROOT } from "./scaffold.helpers.js";

test("score.compute auto-discovers standard architecture inputs from docs-root", async () => {
  const response = await COMMANDS["score.compute"]!(
    {
      repo: path.resolve("fixtures/validation/scoring/qsf/repo"),
      constraints: path.resolve("fixtures/validation/scoring/qsf/constraints.yaml"),
      policy: path.resolve("fixtures/policies/default.yaml"),
      domain: "architecture_design",
      "docs-root": SCAFFOLD_AUTODISCOVERY_DOCS_ROOT,
    },
    { cwd: process.cwd() },
  );

  const qsf = getMetric(response, "QSF");
  const tis = getMetric(response, "TIS");
  const oas = getMetric(response, "OAS");
  const ees = getMetric(response, "EES");

  expect(response.status).toBe("ok");
  expect(qsf.value).toBeGreaterThan(0);
  expect(tis.unknowns.some((entry) => entry.includes("No topology model was provided"))).toBe(false);
  expect(oas.unknowns.some((entry) => entry.includes("No telemetry observations were provided"))).toBe(false);
  expect(ees.unknowns.some((entry) => entry.includes("No delivery observations were provided"))).toBe(false);
});
