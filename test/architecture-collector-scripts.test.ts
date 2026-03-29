import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const TELEMETRY_COLLECTOR = path.resolve("scripts/collectors/architecture/telemetry-export-to-oas.mjs");
const DELIVERY_COLLECTOR = path.resolve("scripts/collectors/architecture/delivery-export-to-ees.mjs");
const COMPLEXITY_COLLECTOR = path.resolve("scripts/collectors/architecture/complexity-snapshot-to-cti.mjs");
const SCENARIO_COLLECTOR = path.resolve("scripts/collectors/architecture/scenario-actualization-to-qsf.mjs");

const COLLECTOR_TELEMETRY_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-good-golden-signals.json",
);
const COLLECTOR_TELEMETRY_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-bad-golden-signals.json",
);
const COLLECTOR_TELEMETRY_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/telemetry-thin-golden-signals.json",
);
const COLLECTOR_DELIVERY_GOOD = path.resolve("fixtures/validation/collectors/architecture/delivery-good-dora.json");
const COLLECTOR_DELIVERY_BAD = path.resolve("fixtures/validation/collectors/architecture/delivery-bad-dora.json");
const COLLECTOR_DELIVERY_THIN = path.resolve("fixtures/validation/collectors/architecture/delivery-thin-dora.json");
const COLLECTOR_COMPLEXITY_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-good-snapshot.json",
);
const COLLECTOR_COMPLEXITY_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-bad-snapshot.json",
);
const COLLECTOR_COMPLEXITY_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/complexity-thin-snapshot.json",
);
const COLLECTOR_SCENARIO_GOOD = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-good-benchmark-summary.json",
);
const COLLECTOR_SCENARIO_BAD = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-bad-benchmark-summary.json",
);
const COLLECTOR_SCENARIO_THIN = path.resolve(
  "fixtures/validation/collectors/architecture/scenario-thin-incident-summary.json",
);

const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
const OAS_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/oas/raw-normalization-profile.yaml");
const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
const EES_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/ees/raw-normalization-profile.yaml");
const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";

describe("architecture reference collectors", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  test("telemetry collector emits canonical OAS export bundles", async () => {
    const output = await runCollector(TELEMETRY_COLLECTOR, COLLECTOR_TELEMETRY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.bands).toHaveLength(3);
    expect(output.bands[0]).toMatchObject({
      bandId: "low",
      trafficWeight: 0.2,
      latencyP95: 210,
    });
    expect(output.patternRuntime).toMatchObject({
      patternFamily: "microservices",
      serviceBasedRuntime: {
        PartialFailureContainmentScore: 0.9,
      },
    });
  });

  test("delivery collector emits canonical EES export bundles", async () => {
    const output = await runCollector(DELIVERY_COLLECTOR, COLLECTOR_DELIVERY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.measurements).toMatchObject({
      leadTime: 3,
      deployFrequency: 18,
      recoveryTime: 1.5,
      changeFailRate: 0.08,
      reworkRate: 0.06,
    });
  });

  test("complexity collector emits canonical CTI export bundles and computes pipelineCount", async () => {
    const output = await runCollector(COMPLEXITY_COLLECTOR, COLLECTOR_COMPLEXITY_GOOD);

    expect(output.version).toBe("1.0");
    expect(output.metrics).toMatchObject({
      teamCount: 2,
      deployableCount: 2,
      pipelineCount: 2,
      onCallSurface: 2,
      runCostPerBusinessTransaction: 1,
    });
  });

  test("scenario collector emits canonical QSF observation sets for benchmark and incident summaries", async () => {
    const benchmarkOutput = await runCollector(SCENARIO_COLLECTOR, COLLECTOR_SCENARIO_GOOD);
    const incidentOutput = await runCollector(SCENARIO_COLLECTOR, COLLECTOR_SCENARIO_THIN);

    expect(benchmarkOutput.observations).toHaveLength(3);
    expect(benchmarkOutput.observations[0]).toMatchObject({
      scenarioId: "S-001",
      observed: 280,
      source: "benchmark_summary",
    });
    expect(incidentOutput.observations).toHaveLength(1);
    expect(incidentOutput.observations[0]).toMatchObject({
      scenarioId: "S-001",
      source: "incident_review_summary",
    });
  });

  test("score.compute accepts telemetry collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "telemetry-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "telemetry-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "telemetry-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(TELEMETRY_COLLECTOR)} ${shellQuote(COLLECTOR_TELEMETRY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": badSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": thinSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "OAS").value).toBeGreaterThan(getMetric(badResponse, "OAS").value);
    expect(thinResponse.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
  });

  test("score.compute accepts scenario collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "scenario-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "scenario-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "scenario-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(SCENARIO_COLLECTOR)} ${shellQuote(COLLECTOR_SCENARIO_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": badSource,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": thinSource,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "QSF").value).toBeGreaterThan(getMetric(badResponse, "QSF").value);
    expect(getMetric(thinResponse, "QSF").unknowns.some((entry) => entry.includes("S-002"))).toBe(true);
  });

  test("score.compute accepts complexity collector command sources end-to-end", async () => {
    const goodSource = await writeSourceConfig(tempRoots, "complexity-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "complexity-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "complexity-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(COMPLEXITY_COLLECTOR)} ${shellQuote(COLLECTOR_COMPLEXITY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": badSource,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": thinSource,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "CTI").value).toBeLessThan(getMetric(badResponse, "CTI").value);
    expect(
      getMetric(thinResponse, "CTI").unknowns.some((entry) => entry.includes("on-call")) ||
        thinResponse.unknowns.length > 0,
    ).toBe(true);
  });

  test("score.compute accepts delivery collector command sources end-to-end", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init collector ees good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init collector ees bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorLocalOne = 'billing-collector-local-1';\n",
      },
      "feat: collector local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorLocalOne = 'fulfillment-collector-local-1';\n",
      },
      "feat: collector local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorCrossOne = 'billing-collector-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorCrossOne = 'fulfillment-collector-cross-1';\n",
      },
      "feat: collector cross 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts":
          "\nexport const billingCollectorCrossTwo = 'billing-collector-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCollectorCrossTwo = 'fulfillment-collector-cross-2';\n",
      },
      "feat: collector cross 2",
    );

    const goodSource = await writeSourceConfig(tempRoots, "delivery-good-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_GOOD)}`,
    });
    const badSource = await writeSourceConfig(tempRoots, "delivery-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_BAD)}`,
    });
    const thinSource = await writeSourceConfig(tempRoots, "delivery-thin-source.json", {
      version: "1.0",
      sourceType: "command",
      cwd: process.cwd(),
      command: `${shellQuote(process.execPath)} ${shellQuote(DELIVERY_COLLECTOR)} ${shellQuote(COLLECTOR_DELIVERY_THIN)}`,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": goodSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": badSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": thinSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    expect(getMetric(goodResponse, "EES").value).toBeGreaterThan(getMetric(badResponse, "EES").value);
    expect(getMetric(thinResponse, "EES").unknowns.some((entry) => entry.includes("DeployFreqScore"))).toBe(true);
  }, 30000);
});

async function runCollector(scriptPath: string, inputPath: string) {
  const { stdout } = await execFile(process.execPath, [scriptPath, inputPath], { cwd: process.cwd() });
  return JSON.parse(stdout);
}

async function writeSourceConfig(tempRoots: string[], fileName: string, payload: unknown): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([]);
  tempRoots.push(tempRoot);
  const targetPath = path.join(tempRoot, fileName);
  await writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
}

async function materializeGitFixture(
  entry: string,
  tempRoots: string[],
  initialCommitMessage: string,
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([entry]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, entry);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

async function appendAndCommit(repoPath: string, updates: Record<string, string>, message: string): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    const current = await readFile(targetPath, "utf8");
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function getMetric(response: Awaited<ReturnType<NonNullable<(typeof COMMANDS)["score.compute"]>>>, metricId: string) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      components: Record<string, number>;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}
