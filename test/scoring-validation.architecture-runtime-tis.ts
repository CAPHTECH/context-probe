import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  getMetric,
  POLICY_PATH,
  TIS_BAD_RUNTIME_PATH,
  TIS_BAD_TOPOLOGY_PATH,
  TIS_CONSTRAINTS_PATH,
  TIS_GOOD_RUNTIME_PATH,
  TIS_GOOD_TOPOLOGY_PATH,
  TIS_REPO,
} from "./scoring-validation.helpers.js";

export function registerArchitectureRuntimeTopologyScoringValidationTests(): void {
  test("TIS is higher for isolated topologies than for shared-dependency topologies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH,
      },
      { cwd: process.cwd() },
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodTis = getMetric(goodResponse, "TIS");
    const badTis = getMetric(badResponse, "TIS");
    const thinTis = getMetric(thinResponse, "TIS");

    expect(goodTis.value).toBeGreaterThan(badTis.value);
    expect(goodTis.components.FI ?? 0).toBeGreaterThan(badTis.components.FI ?? 0);
    expect(goodTis.components.RC ?? 0).toBeGreaterThan(badTis.components.RC ?? 0);
    expect(badTis.components.SDR ?? 0).toBeGreaterThan(goodTis.components.SDR ?? 0);
    expect(thinTis.unknowns.some((entry) => entry.includes("static proxy"))).toBe(true);
  });
}
