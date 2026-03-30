import { expect, test } from "vitest";

import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../src/analyzers/code.js";
import { COMMANDS } from "../src/commands.js";
import { loadDomainModel } from "../src/core/model.js";

import { DART_DOMAIN_BAD_REPO, DART_DOMAIN_GOOD_REPO, DART_DOMAIN_MODEL, POLICY_PATH } from "./dart-support.helpers.js";

export function registerDartSupportDomainDesignTests(): void {
  test("computes MCCS and boundary leaks for Dart domain-design repositories", async () => {
    const model = await loadDomainModel(DART_DOMAIN_MODEL);
    const goodCodebase = await parseCodebase(DART_DOMAIN_GOOD_REPO);
    const badCodebase = await parseCodebase(DART_DOMAIN_BAD_REPO);

    expect(detectContractUsage(goodCodebase, model).adherence).toBe(1);
    expect(detectContractUsage(badCodebase, model).adherence).toBe(0);
    expect(detectBoundaryLeaks(goodCodebase, model)).toHaveLength(0);
    expect(detectBoundaryLeaks(badCodebase, model)).toHaveLength(1);

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DART_DOMAIN_GOOD_REPO,
        model: DART_DOMAIN_MODEL,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DART_DOMAIN_BAD_REPO,
        model: DART_DOMAIN_MODEL,
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    const getMetric = (response: { result: unknown }, metricId: string): number =>
      (response.result as { metrics: Array<{ metricId: string; value: number }> }).metrics.find(
        (entry) => entry.metricId === metricId,
      )?.value ?? 0;

    expect(goodResponse.status).not.toBe("error");
    expect(badResponse.status).not.toBe("error");
    expect(getMetric(goodResponse, "MCCS")).toBeGreaterThan(getMetric(badResponse, "MCCS"));
  });
}
