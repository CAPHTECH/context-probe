import { rm } from "node:fs/promises";

import { afterEach, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  CTI_BAD_CONSTRAINTS_PATH,
  CTI_GOOD_REPO,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  QSF_CONSTRAINTS_PATH,
  QSF_REPO,
  QSF_SCENARIOS_PATH,
} from "./architecture-collector-scripts.helpers.js";

const SCENARIO_BENCHMARK_SUMMARY_PATH = "fixtures/examples/architecture-sources/scenario-benchmark-summary.json";
const DELIVERY_DORA_SUMMARY_PATH = "fixtures/examples/architecture-sources/delivery-dora-summary.json";
const COMPLEXITY_SNAPSHOT_PATH = "fixtures/examples/architecture-sources/complexity-snapshot.json";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

test("score.compute accepts scenario benchmark summaries directly as scenario observations", async () => {
  const response = await COMMANDS["score.compute"]!(
    {
      repo: QSF_REPO,
      constraints: QSF_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "scenario-catalog": QSF_SCENARIOS_PATH,
      "scenario-observations": SCENARIO_BENCHMARK_SUMMARY_PATH,
    },
    { cwd: process.cwd() },
  );

  const qsf = getMetric(response, "QSF");

  expect(response.status).toBe("ok");
  expect(qsf.value).toBeGreaterThan(0);
  expect(qsf.unknowns.some((entry) => entry.includes("No scenario observations were provided"))).toBe(false);
});

test("score.compute accepts DORA delivery summaries directly as delivery exports", async () => {
  const repoPath = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init delivery export compat");

  const response = await COMMANDS["score.compute"]!(
    {
      repo: repoPath,
      constraints: EES_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "boundary-map": EES_BOUNDARY_MAP_PATH,
      "delivery-export": DELIVERY_DORA_SUMMARY_PATH,
    },
    { cwd: process.cwd() },
  );

  const ees = getMetric(response, "EES");

  expect(response.status).toBe("ok");
  expect(ees.value).toBeGreaterThan(0);
  expect(ees.unknowns.some((entry) => entry.includes("No delivery normalization profile"))).toBe(false);
  expect(ees.unknowns.some((entry) => entry.includes("LeadTimeScore is missing"))).toBe(false);
  expect(response.evidence.some((entry) => entry.statement.includes("delivery export"))).toBe(true);
});

test("score.compute accepts complexity snapshots directly as complexity exports", async () => {
  const response = await COMMANDS["score.compute"]!(
    {
      repo: CTI_GOOD_REPO,
      constraints: CTI_BAD_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "complexity-export": COMPLEXITY_SNAPSHOT_PATH,
    },
    { cwd: process.cwd() },
  );

  const cti = getMetric(response, "CTI");

  expect(response.status).toBe("ok");
  expect(cti.value).toBeGreaterThan(0);
  expect(cti.unknowns.some((entry) => entry.includes("runCostPerBusinessTransaction"))).toBe(false);
});
