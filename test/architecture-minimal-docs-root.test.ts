import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { getMetric } from "./architecture-collector-scripts.helpers.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

test("score.compute auto-discovers standard architecture inputs from docs-root", async () => {
  const docsRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-architecture-docs-"));
  tempRoots.push(docsRoot);

  const contextProbeRoot = path.join(docsRoot, "architecture/context-probe");
  await mkdir(contextProbeRoot, { recursive: true });

  await Promise.all([
    cp("fixtures/validation/scoring/qsf/scenarios.yaml", path.join(contextProbeRoot, "architecture-scenarios.yaml")),
    cp(
      "fixtures/validation/collectors/architecture/scenario-good-benchmark-summary.json",
      path.join(contextProbeRoot, "architecture-scenario-observations.yaml"),
    ),
    cp("fixtures/validation/scoring/tis/good-topology.yaml", path.join(contextProbeRoot, "architecture-topology.yaml")),
    cp(
      "fixtures/validation/scoring/aels/boundary-map.yaml",
      path.join(contextProbeRoot, "architecture-boundary-map.yaml"),
    ),
    cp(
      "fixtures/validation/scoring/oas/good-telemetry.yaml",
      path.join(contextProbeRoot, "architecture-telemetry-observations.yaml"),
    ),
    cp(
      "fixtures/validation/scoring/ees/good-delivery.yaml",
      path.join(contextProbeRoot, "architecture-delivery-observations.yaml"),
    ),
  ]);

  const response = await COMMANDS["score.compute"]!(
    {
      repo: path.resolve("fixtures/validation/scoring/qsf/repo"),
      constraints: path.resolve("fixtures/validation/scoring/qsf/constraints.yaml"),
      policy: path.resolve("fixtures/policies/default.yaml"),
      domain: "architecture_design",
      "docs-root": docsRoot,
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
