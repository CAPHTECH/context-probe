import { chmod } from "node:fs/promises";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import {
  appendAndCommit,
  DATA_FILE_STUB,
  EES_BASE_ENTRY,
  EES_BOUNDARY_MAP_PATH,
  EES_CONSTRAINTS_PATH,
  EES_EXPORT_BAD_DELIVERY_PATH,
  EES_EXPORT_GOOD_DELIVERY_PATH,
  EES_EXPORT_THIN_DELIVERY_PATH,
  EES_GOOD_DELIVERY_PATH,
  EES_RAW_BAD_DELIVERY_PATH,
  EES_RAW_PROFILE_PATH,
  getMetric,
  materializeGitFixture,
  POLICY_PATH,
  shellQuote,
  writeJsonFixture,
} from "./scoring-validation.helpers.js";

export function registerArchitectureEvolutionDeliverySourceScoringValidationTests(tempRoots: string[]): void {
  test("EES also supports delivery sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceLocalOne = 'billing-source-local-1';\n",
      },
      "feat: source local 1",
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceLocalOne = 'fulfillment-source-local-1';\n",
      },
      "feat: source local 2",
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossOne = 'billing-source-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceCrossOne = 'fulfillment-source-cross-1';\n",
      },
      "feat: source cross-boundary 1",
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossTwo = 'billing-source-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentSourceCrossTwo = 'fulfillment-source-cross-2';\n",
      },
      "feat: source cross-boundary 2",
    );

    const goodFileSource = await writeJsonFixture(tempRoots, "ees-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH,
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "ees-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(EES_EXPORT_BAD_DELIVERY_PATH)}`,
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "ees-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_THIN_DELIVERY_PATH,
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": goodFileSource,
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
        "delivery-source": badCommandSource,
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
        "delivery-source": thinFileSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
      },
      { cwd: process.cwd() },
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery export"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("delivery source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  }, 30000);

  test("normalized delivery observations take precedence over raw, export, and source delivery inputs", async () => {
    const repo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees precedence");

    await appendAndCommit(
      repo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingPrecedenceOne = 'billing-precedence-1';\n",
      },
      "feat: precedence local 1",
    );
    await appendAndCommit(
      repo,
      {
        "src/fulfillment/internal/fulfillment-service.ts":
          "\nexport const fulfillmentPrecedenceOne = 'fulfillment-precedence-1';\n",
      },
      "feat: precedence local 2",
    );

    const goodSource = await writeJsonFixture(tempRoots, "ees-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH,
    });

    const normalizedResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
      },
      { cwd: process.cwd() },
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );

    const normalizedEes = getMetric(normalizedResponse, "EES");
    const precedenceEes = getMetric(precedenceResponse, "EES");

    expect(precedenceEes.components.Delivery ?? 0).toBeCloseTo(normalizedEes.components.Delivery ?? 0, 6);
    expect(precedenceEes.unknowns.some((entry) => entry.includes("A higher-priority delivery input was present"))).toBe(
      true,
    );

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    expect(rawResponse.unknowns.some((entry) => entry.includes("delivery source was not used"))).toBe(true);

    const exportResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource,
      },
      { cwd: process.cwd() },
    );
    expect(exportResponse.unknowns.some((entry) => entry.includes("delivery source was not used"))).toBe(true);
  }, 30000);
}
