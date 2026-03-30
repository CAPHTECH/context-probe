import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { MetricScore } from "../src/core/contracts.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const REPO_PATH = path.resolve("fixtures/validation/scoring/tis/repo");
const CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");

function getMetric(metrics: MetricScore[], metricId: string): MetricScore | undefined {
  return metrics.find((entry) => entry.metricId === metricId);
}

describe("kakusill-style architecture input compatibility", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(tempPaths.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
  });

  test("score.compute normalizes legacy scenario, topology, boundary, and telemetry artifacts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-kakusill-compat-"));
    tempPaths.push(tempRoot);

    const scenarioPath = path.join(tempRoot, "scenario-catalog.yaml");
    const topologyPath = path.join(tempRoot, "topology-model.yaml");
    const boundaryPath = path.join(tempRoot, "boundary-map.yaml");
    const telemetryPath = path.join(tempRoot, "telemetry-observations.yaml");

    await writeFile(
      scenarioPath,
      `schema_version: 1
catalog:
  name: architecture-scenario-catalog
scenarios:
  - id: sample-runtime-flow
    name: Sample runtime flow
    priority: core
    entry_surface:
      user_surface: Sample UI
      trigger: User triggers the main flow
    quality_expectations:
      - attribute: traceability
        expectation: Request path remains observable end-to-end.
`,
      "utf8",
    );

    await writeFile(
      topologyPath,
      `schema_version: 1
deployables:
  - id: web_app
    kind: nextjs-app
  - id: shared_runtime
    kind: lambda-function-url
datastores:
  - id: primary_db
    kind: postgres
services:
  - id: http_entry
    deployable: web_app
    kind: route-handler
    depends_on:
      - service:agent_job
      - datastore:primary_db
  - id: agent_job
    deployable: shared_runtime
    kind: worker
    depends_on:
      - datastore:primary_db
`,
      "utf8",
    );

    await writeFile(
      boundaryPath,
      `version: "1.0"
contexts:
  - name: presentation
    pathGlobs:
      - src/infrastructure/**
  - name: domain
    pathGlobs:
      - src/domain/**
  - name: application
    pathGlobs:
      - src/application/**
`,
      "utf8",
    );

    await writeFile(
      telemetryPath,
      `schema_version: 1
sources:
  - id: main_runtime_logs
    status: emitting
observations:
  - id: request_lifecycle
    status: observed-in-code
    gaps:
      - No live metric filter was sampled.
`,
      "utf8",
    );

    const response = await COMMANDS["score.compute"]!(
      {
        domain: "architecture_design",
        repo: REPO_PATH,
        constraints: CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        "scenario-catalog": scenarioPath,
        "topology-model": topologyPath,
        "boundary-map": boundaryPath,
        "telemetry-observations": telemetryPath,
      },
      { cwd: process.cwd() },
    );

    expect(response.status).not.toBe("error");
    expect(response.diagnostics).toEqual([]);

    const result = response.result as { metrics: MetricScore[] };
    const qsf = getMetric(result.metrics, "QSF");
    const tis = getMetric(result.metrics, "TIS");
    const oas = getMetric(result.metrics, "OAS");

    expect(qsf?.unknowns.some((entry) => entry.includes("No scenario catalog was provided"))).toBe(false);
    expect(tis?.unknowns.some((entry) => entry.includes("No topology model was provided"))).toBe(false);
    expect(oas?.unknowns.some((entry) => entry.includes("No telemetry observations were provided"))).toBe(false);
    expect(response.unknowns.some((entry) => entry.includes("No boundary map was provided"))).toBe(false);
  });
});
