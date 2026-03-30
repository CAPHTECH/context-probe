import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  AELS_BASE_ENTRY,
  AELS_BOUNDARY_MAP_PATH,
  AELS_CONSTRAINTS_PATH,
  appendAndCommit,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionLocalityScoringValidationTests(tempRoots: string[]): void {
  test("AELS is higher for architecture histories that stay within boundaries", async () => {
    const localRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels local");
    const scatteredRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels scattered");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalOne = 'billing-local-1';\n",
      },
      "feat: billing local 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentLocalOne = 'fulfillment-local-1';\n",
      },
      "feat: fulfillment local 1",
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalTwo = 'billing-local-2';\n",
      },
      "feat: billing local 2",
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossOne = 'billing-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossOne = 'fulfillment-cross-1';\n",
      },
      "feat: cross-boundary 1",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossTwo = 'billing-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossTwo = 'fulfillment-cross-2';\n",
      },
      "feat: cross-boundary 2",
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossThree = 'billing-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentCrossThree = 'fulfillment-cross-3';\n",
      },
      "feat: cross-boundary 3",
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH,
      },
      { cwd: process.cwd() },
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH,
      },
      { cwd: process.cwd() },
    );

    const localAels = getMetric(localResponse, "AELS");
    const scatteredAels = getMetric(scatteredResponse, "AELS");

    expect(localAels.value).toBeGreaterThan(scatteredAels.value);
    expect(scatteredAels.components.CrossBoundaryCoChange ?? 0).toBeGreaterThan(
      localAels.components.CrossBoundaryCoChange ?? 0,
    );
    expect(scatteredAels.components.WeightedPropagationCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedPropagationCost ?? 0,
    );
    expect(scatteredAels.components.WeightedClusteringCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedClusteringCost ?? 0,
    );
  }, 30000);
}
