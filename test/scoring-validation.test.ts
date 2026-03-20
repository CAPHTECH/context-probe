import { execFile as execFileCallback } from "node:child_process";
import { chmod } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const execFile = promisify(execFileCallback);

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const CODEX_STUB = path.resolve("test/fixtures/stubs/codex-stub.mjs");
const DATA_FILE_STUB = path.resolve("test/fixtures/stubs/emit-data-file.mjs");
const MCCS_MODEL_PATH = path.resolve("fixtures/validation/scoring/mccs/model.yaml");
const MCCS_GOOD_ENTRY = "fixtures/validation/scoring/mccs/good-repo";
const MCCS_BAD_ENTRY = "fixtures/validation/scoring/mccs/bad-repo";
const DDS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/dds/constraints.yaml");
const DDS_GOOD_REPO = path.resolve("fixtures/validation/scoring/dds/good-repo");
const DDS_BAD_REPO = path.resolve("fixtures/validation/scoring/dds/bad-repo");
const BPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/bps/constraints.yaml");
const BPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/bps/good-repo");
const BPS_BAD_REPO = path.resolve("fixtures/validation/scoring/bps/bad-repo");
const IPS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ips/constraints.yaml");
const IPS_GOOD_REPO = path.resolve("fixtures/validation/scoring/ips/good-repo");
const IPS_BAD_REPO = path.resolve("fixtures/validation/scoring/ips/bad-repo");
const CTI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/good-constraints.yaml");
const CTI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/cti/bad-constraints.yaml");
const CTI_GOOD_REPO = path.resolve("fixtures/validation/scoring/cti/good-repo");
const CTI_BAD_REPO = path.resolve("fixtures/validation/scoring/cti/bad-repo");
const CTI_GOOD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-good-complexity.yaml");
const CTI_BAD_EXPORT_PATH = path.resolve("fixtures/validation/scoring/cti/export-bad-complexity.yaml");
const QSF_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/qsf/constraints.yaml");
const QSF_REPO = path.resolve("fixtures/validation/scoring/qsf/repo");
const QSF_SCENARIOS_PATH = path.resolve("fixtures/validation/scoring/qsf/scenarios.yaml");
const QSF_GOOD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/good-observations.yaml");
const QSF_BAD_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/bad-observations.yaml");
const QSF_THIN_OBSERVATIONS_PATH = path.resolve("fixtures/validation/scoring/qsf/thin-observations.yaml");
const APSI_GOOD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/good-constraints.yaml");
const APSI_BAD_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/apsi/bad-constraints.yaml");
const APSI_FORMULAS = {
  default: { QSF: 0.3, PCS: 0.2, OAS: 0.2, EES: 0.15, CTI: 0.15 },
  layered: { QSF: 0.35, PCS: 0.3, OAS: 0.15, EES: 0.1, CTI: 0.1 },
  service_based: { QSF: 0.2, PCS: 0.2, OAS: 0.15, EES: 0.25, CTI: 0.2 },
  cqrs: { QSF: 0.3, PCS: 0.15, OAS: 0.25, EES: 0.1, CTI: 0.2 },
  event_driven: { QSF: 0.2, PCS: 0.15, OAS: 0.3, EES: 0.1, CTI: 0.25 }
} as const;
const TIS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/tis/constraints.yaml");
const TIS_REPO = path.resolve("fixtures/validation/scoring/tis/repo");
const TIS_GOOD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/good-topology.yaml");
const TIS_BAD_TOPOLOGY_PATH = path.resolve("fixtures/validation/scoring/tis/bad-topology.yaml");
const TIS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/good-runtime.yaml");
const TIS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/tis/bad-runtime.yaml");
const OAS_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/good-telemetry.yaml");
const OAS_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/bad-telemetry.yaml");
const OAS_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/thin-telemetry.yaml");
const OAS_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/oas/raw-normalization-profile.yaml");
const OAS_RAW_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-good-telemetry.yaml");
const OAS_RAW_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-bad-telemetry.yaml");
const OAS_RAW_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/raw-thin-telemetry.yaml");
const OAS_EXPORT_GOOD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/export-good-telemetry.yaml");
const OAS_EXPORT_BAD_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/export-bad-telemetry.yaml");
const OAS_EXPORT_THIN_TELEMETRY_PATH = path.resolve("fixtures/validation/scoring/oas/export-thin-telemetry.yaml");
const OAS_GOOD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/good-runtime.yaml");
const OAS_BAD_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/bad-runtime.yaml");
const OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-good-runtime.yaml"
);
const OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-layered-bad-runtime.yaml"
);
const OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-good-runtime.yaml"
);
const OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-microservices-bad-runtime.yaml"
);
const OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-good-runtime.yaml"
);
const OAS_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-cqrs-bad-runtime.yaml"
);
const OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-good-runtime.yaml"
);
const OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-event-driven-bad-runtime.yaml"
);
const OAS_FAMILY_THIN_RUNTIME_PATH = path.resolve("fixtures/validation/scoring/oas/family-thin-runtime.yaml");
const OAS_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/family-mismatch-runtime.yaml"
);
const OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-pattern-runtime-normalization-profile.yaml"
);
const OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-good-runtime.yaml"
);
const OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-layered-bad-runtime.yaml"
);
const OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-good-runtime.yaml"
);
const OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-microservices-bad-runtime.yaml"
);
const OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-good-runtime.yaml"
);
const OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-cqrs-bad-runtime.yaml"
);
const OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-good-runtime.yaml"
);
const OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-event-driven-bad-runtime.yaml"
);
const OAS_RAW_FAMILY_THIN_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-thin-runtime.yaml"
);
const OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH = path.resolve(
  "fixtures/validation/scoring/oas/raw-family-mismatch-runtime.yaml"
);
const AELS_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/aels/constraints.yaml");
const AELS_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/aels/boundary-map.yaml");
const AELS_BASE_ENTRY = "fixtures/validation/scoring/aels/base-repo";
const EES_CONSTRAINTS_PATH = path.resolve("fixtures/validation/scoring/ees/constraints.yaml");
const EES_BOUNDARY_MAP_PATH = path.resolve("fixtures/validation/scoring/ees/boundary-map.yaml");
const EES_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/good-delivery.yaml");
const EES_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/bad-delivery.yaml");
const EES_RAW_PROFILE_PATH = path.resolve("fixtures/validation/scoring/ees/raw-normalization-profile.yaml");
const EES_RAW_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-good-delivery.yaml");
const EES_RAW_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-bad-delivery.yaml");
const EES_RAW_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/raw-thin-delivery.yaml");
const EES_EXPORT_GOOD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-good-delivery.yaml");
const EES_EXPORT_BAD_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-bad-delivery.yaml");
const EES_EXPORT_THIN_DELIVERY_PATH = path.resolve("fixtures/validation/scoring/ees/export-thin-delivery.yaml");
const EES_BASE_ENTRY = "fixtures/validation/scoring/ees/base-repo";
const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";
const BFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/bfs/model.yaml");
const BFS_GOOD_ENTRY = "fixtures/validation/scoring/bfs/good";
const BFS_BAD_ENTRY = "fixtures/validation/scoring/bfs/bad-misaligned";
const AFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/afs/model.yaml");
const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";
const AFS_BAD_ENTRY = "fixtures/validation/scoring/afs/bad-cross-transaction";
const DRF_MODEL_PATH = path.resolve("fixtures/validation/scoring/drf/model.yaml");
const DRF_GOOD_ENTRY = "fixtures/validation/scoring/drf/good";
const DRF_BAD_ENTRY = "fixtures/validation/scoring/drf/bad-ambiguous";
const ULI_MODEL_PATH = path.resolve("fixtures/validation/scoring/uli/model.yaml");
const ULI_GOOD_ENTRY = "fixtures/validation/scoring/uli/good";
const ULI_BAD_TRACE_ENTRY = "fixtures/validation/scoring/uli/bad-trace";

describe("score validation", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
  });

  test("MCCS is higher for contract-compliant repositories than for leaking repositories", async () => {
    const goodRepo = await materializeGitFixture(MCCS_GOOD_ENTRY, tempRoots, "feat: init good mccs");
    const badRepo = await materializeGitFixture(MCCS_BAD_ENTRY, tempRoots, "feat: init bad mccs");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: MCCS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    const goodMccs = getMetric(goodResponse, "MCCS");
    const badMccs = getMetric(badResponse, "MCCS");

    expect(goodMccs.value).toBeGreaterThan(badMccs.value);
    expect(goodMccs.value).toBe(1);
    expect(badMccs.value).toBe(0);
  }, 20000);

  test("DDS is higher for inward-only dependencies than for violating dependencies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_GOOD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DDS_BAD_REPO,
        constraints: DDS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodDds = getMetric(goodResponse, "DDS");
    const badDds = getMetric(badResponse, "DDS");

    expect(goodDds.value).toBeGreaterThan(badDds.value);
    expect(goodDds.value).toBe(1);
    expect(badDds.value).toBeLessThan(0.58);
  });

  test("BPS is higher for contained outer-layer code than for leaked and shared internal code", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_GOOD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: BPS_BAD_REPO,
        constraints: BPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodBps = getMetric(goodResponse, "BPS");
    const badBps = getMetric(badResponse, "BPS");

    expect(goodBps.value).toBeGreaterThan(badBps.value);
    expect(goodBps.components.FCC ?? 0).toBeGreaterThan(badBps.components.FCC ?? 0);
    expect(badBps.components.ALR ?? 0).toBeGreaterThan(goodBps.components.ALR ?? 0);
    expect(badBps.components.SICR ?? 0).toBeGreaterThan(goodBps.components.SICR ?? 0);
  });

  test("IPS is higher for clean public contracts than for implementation-coupled contracts", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_GOOD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: IPS_BAD_REPO,
        constraints: IPS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodIps = getMetric(goodResponse, "IPS");
    const badIps = getMetric(badResponse, "IPS");

    expect(goodIps.value).toBeGreaterThan(badIps.value);
    expect(goodIps.components.CBC ?? 0).toBeGreaterThan(badIps.components.CBC ?? 0);
    expect(badIps.components.BCR ?? 0).toBeGreaterThan(goodIps.components.BCR ?? 0);
    expect(goodIps.components.SLA ?? 0).toBeGreaterThan(badIps.components.SLA ?? 0);
  });

  test("CTI is lower for lean operational setups than for complexity-heavy setups", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design"
      },
      { cwd: process.cwd() }
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(badCti.components.DeployablesPerTeam ?? 0).toBeGreaterThan(goodCti.components.DeployablesPerTeam ?? 0);
    expect(badCti.components.ContractsOrSchemasPerService ?? 0).toBeGreaterThan(
      goodCti.components.ContractsOrSchemasPerService ?? 0
    );
    expect(badCti.components.SyncDepthOverhead ?? 0).toBeGreaterThan(goodCti.components.SyncDepthOverhead ?? 0);
  });

  test("CTI also ingests operational export bundles and lets export data override fallback metadata", async () => {
    const exportedGoodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_GOOD_EXPORT_PATH
      },
      { cwd: process.cwd() }
    );
    const exportedBadResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH
      },
      { cwd: process.cwd() }
    );

    const goodCti = getMetric(exportedGoodResponse, "CTI");
    const badCti = getMetric(exportedBadResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodCti.components.DeployablesPerTeam ?? 1).toBeLessThan(badCti.components.DeployablesPerTeam ?? 0);
    expect(goodCti.unknowns.some((entry) => entry.includes("complexity export"))).toBe(false);
  });

  test("CTI also supports complexity source configs via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "cti-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "cti-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(CTI_BAD_EXPORT_PATH)}`
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_GOOD_REPO,
        constraints: CTI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": goodFileSource
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-source": badCommandSource
      },
      { cwd: process.cwd() }
    );

    const goodCti = getMetric(goodResponse, "CTI");
    const badCti = getMetric(badResponse, "CTI");

    expect(goodCti.value).toBeLessThan(badCti.value);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("complexity source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("explicit complexity export takes precedence over complexity sources", async () => {
    const goodSource = await writeJsonFixture(tempRoots, "cti-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: CTI_GOOD_EXPORT_PATH
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: CTI_BAD_REPO,
        constraints: CTI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "complexity-export": CTI_BAD_EXPORT_PATH,
        "complexity-source": goodSource
      },
      { cwd: process.cwd() }
    );

    const cti = getMetric(response, "CTI");

    expect(cti.value).toBeGreaterThan(0.4);
    expect(response.unknowns.some((entry) => entry.includes("complexity source は優先されません"))).toBe(true);
  });

  test("QSF is higher for scenario-observing candidates than for scenario-missing or poor-fit candidates", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_THIN_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodQsf.components.weighted_coverage ?? 0).toBeGreaterThan(thinQsf.components.weighted_coverage ?? 0);
    expect(goodQsf.components.average_normalized_score ?? 0).toBeGreaterThan(
      badQsf.components.average_normalized_score ?? 0
    );
  });

  test("QSF also supports scenario observation sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "qsf-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_GOOD_OBSERVATIONS_PATH
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "qsf-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(QSF_BAD_OBSERVATIONS_PATH)}`
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "qsf-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_THIN_OBSERVATIONS_PATH
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": goodFileSource
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": badCommandSource
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observation-source": thinFileSource
      },
      { cwd: process.cwd() }
    );

    const goodQsf = getMetric(goodResponse, "QSF");
    const badQsf = getMetric(badResponse, "QSF");
    const thinQsf = getMetric(thinResponse, "QSF");

    expect(goodQsf.value).toBeGreaterThan(badQsf.value);
    expect(goodQsf.value).toBeGreaterThan(thinQsf.value);
    expect(thinQsf.unknowns.some((entry) => entry.includes("observed value"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("scenario observation source config"))).toBe(true);
  });

  test("explicit scenario observations take precedence over scenario observation sources", async () => {
    const badSource = await writeJsonFixture(tempRoots, "qsf-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: QSF_BAD_OBSERVATIONS_PATH
    });

    const explicitResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH
      },
      { cwd: process.cwd() }
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: QSF_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
        "scenario-observation-source": badSource
      },
      { cwd: process.cwd() }
    );

    expect(getMetric(precedenceResponse, "QSF").value).toBeCloseTo(getMetric(explicitResponse, "QSF").value, 6);
    expect(precedenceResponse.unknowns.some((entry) => entry.includes("scenario observation source は優先されません"))).toBe(true);
  });

  test("APSI is higher when scenario fit, conformance proxies, runtime proxies, evolution, and complexity tax all align", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: APSI_GOOD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH,
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: QSF_REPO,
        constraints: APSI_BAD_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "scenario-catalog": QSF_SCENARIOS_PATH,
        "scenario-observations": QSF_BAD_OBSERVATIONS_PATH,
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH,
        "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH,
        "delivery-observations": EES_BAD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );

    const goodApsi = getMetric(goodResponse, "APSI");
    const badApsi = getMetric(badResponse, "APSI");

    expect(goodApsi.value).toBeGreaterThan(badApsi.value);
    expect(goodApsi.components.QSF ?? 0).toBeGreaterThan(badApsi.components.QSF ?? 0);
    expect(goodApsi.components.OAS ?? 0).toBeGreaterThan(badApsi.components.OAS ?? 0);
    expect(goodApsi.components.EES ?? 0).toBeGreaterThan(badApsi.components.EES ?? 0);
    expect(goodApsi.components.CTI ?? 0).toBeLessThan(badApsi.components.CTI ?? 0);
    expect(goodApsi.unknowns.some((entry) => entry.includes("PCS は DDS/BPS/IPS"))).toBe(true);
    expect(goodApsi.unknowns.some((entry) => entry.includes("OAS は TIS"))).toBe(false);
  });

  test("APSI follows the selected policy profile weights without changing supporting metrics", async () => {
    const baseArgs = {
      repo: QSF_REPO,
      constraints: APSI_GOOD_CONSTRAINTS_PATH,
      policy: POLICY_PATH,
      domain: "architecture_design",
      "scenario-catalog": QSF_SCENARIOS_PATH,
      "scenario-observations": QSF_GOOD_OBSERVATIONS_PATH,
      "topology-model": TIS_GOOD_TOPOLOGY_PATH,
      "runtime-observations": TIS_GOOD_RUNTIME_PATH,
      "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
      "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH,
      "delivery-observations": EES_BAD_DELIVERY_PATH
    } as const;

    const defaultResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "default"
      },
      { cwd: process.cwd() }
    );
    const layeredResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "layered"
      },
      { cwd: process.cwd() }
    );
    const serviceBasedResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "service_based"
      },
      { cwd: process.cwd() }
    );
    const cqrsResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "cqrs"
      },
      { cwd: process.cwd() }
    );
    const eventDrivenResponse = await COMMANDS["score.compute"]!(
      {
        ...baseArgs,
        profile: "event_driven"
      },
      { cwd: process.cwd() }
    );

    const defaultApsi = getMetric(defaultResponse, "APSI");
    const layeredApsi = getMetric(layeredResponse, "APSI");
    const serviceBasedApsi = getMetric(serviceBasedResponse, "APSI");
    const cqrsApsi = getMetric(cqrsResponse, "APSI");
    const eventDrivenApsi = getMetric(eventDrivenResponse, "APSI");

    expect(layeredApsi.components).toEqual(defaultApsi.components);
    expect(serviceBasedApsi.components).toEqual(defaultApsi.components);
    expect(cqrsApsi.components).toEqual(defaultApsi.components);
    expect(eventDrivenApsi.components).toEqual(defaultApsi.components);

    expect(defaultApsi.value).toBeCloseTo(computeApsiFromWeights(defaultApsi.components, APSI_FORMULAS.default), 10);
    expect(layeredApsi.value).toBeCloseTo(computeApsiFromWeights(layeredApsi.components, APSI_FORMULAS.layered), 10);
    expect(serviceBasedApsi.value).toBeCloseTo(
      computeApsiFromWeights(serviceBasedApsi.components, APSI_FORMULAS.service_based),
      10
    );
    expect(cqrsApsi.value).toBeCloseTo(computeApsiFromWeights(cqrsApsi.components, APSI_FORMULAS.cqrs), 10);
    expect(eventDrivenApsi.value).toBeCloseTo(
      computeApsiFromWeights(eventDrivenApsi.components, APSI_FORMULAS.event_driven),
      10
    );

    expect(layeredApsi.value).not.toBeCloseTo(defaultApsi.value, 10);
    expect(serviceBasedApsi.value).not.toBeCloseTo(defaultApsi.value, 10);
    expect(layeredApsi.unknowns.some((entry) => entry.includes("layered policy profile"))).toBe(true);
    expect(serviceBasedApsi.unknowns.some((entry) => entry.includes("service_based policy profile"))).toBe(true);
  });

  test("OAS is higher when traffic-band operations and pattern runtime both remain healthy", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_BAD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_THIN_TELEMETRY_PATH
      },
      { cwd: process.cwd() }
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(goodOas.components.PatternRuntime ?? 0).toBeGreaterThan(badOas.components.PatternRuntime ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("CommonOps"))).toBe(true);
    expect(thinOas.unknowns.some((entry) => entry.includes("PatternRuntime"))).toBe(true);
  });

  test("OAS also supports raw telemetry observations through an explicit normalization profile", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "pattern-runtime-observations": OAS_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_THIN_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("raw"))).toBe(true);
  });

  test("OAS also supports telemetry export bundles and embedded runtime observations", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_THIN_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.PatternRuntime ?? 0).toBeGreaterThan(badOas.components.PatternRuntime ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
    expect(thinOas.unknowns.some((entry) => entry.includes("PatternRuntime"))).toBe(true);
  });

  test("OAS also supports telemetry sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodFileSource = await writeJsonFixture(tempRoots, "oas-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_GOOD_TELEMETRY_PATH
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "oas-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(OAS_EXPORT_BAD_TELEMETRY_PATH)}`
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "oas-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_THIN_TELEMETRY_PATH
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": goodFileSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": badCommandSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-source": thinFileSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const goodOas = getMetric(goodResponse, "OAS");
    const badOas = getMetric(badResponse, "OAS");
    const thinOas = getMetric(thinResponse, "OAS");

    expect(goodOas.value).toBeGreaterThan(badOas.value);
    expect(goodOas.components.CommonOps ?? 0).toBeGreaterThan(badOas.components.CommonOps ?? 0);
    expect(thinOas.unknowns.some((entry) => entry.includes("telemetry export"))).toBe(true);
    expect(goodResponse.evidence.some((entry) => entry.statement.includes("telemetry source config"))).toBe(true);
    expect(badResponse.evidence.some((entry) => entry.statement.includes("command source"))).toBe(true);
  });

  test("normalized, raw, and export telemetry inputs take precedence over telemetry sources", async () => {
    const goodSource = await writeJsonFixture(tempRoots, "oas-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: OAS_EXPORT_GOOD_TELEMETRY_PATH
    });

    const response = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const oas = getMetric(response, "OAS");

    expect(oas.components.CommonOps ?? 0).toBeGreaterThan(0.7);
    expect(
      oas.unknowns.some((entry) => entry.includes("telemetry-observations が指定されているため raw/export/source telemetry input は優先されません"))
    ).toBe(true);

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-raw-observations": OAS_RAW_BAD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "telemetry-source": goodSource
      },
      { cwd: process.cwd() }
    );
    expect(rawResponse.unknowns.some((entry) => entry.includes("telemetry source は利用されません"))).toBe(true);

    const exportResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_BAD_TELEMETRY_PATH,
        "telemetry-source": goodSource,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    expect(exportResponse.unknowns.some((entry) => entry.includes("telemetry source は利用されません"))).toBe(true);
  });

  test("OAS derives PatternRuntime from family-specific runtime schemas", async () => {
    const layeredGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_LAYERED_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const layeredBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_LAYERED_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const microservicesGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const microservicesBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const cqrsGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_CQRS_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const cqrsBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_CQRS_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const eventDrivenGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const eventDrivenBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );

    expect(getMetric(layeredGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(layeredBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(microservicesGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(microservicesBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(cqrsGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(cqrsBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(eventDrivenGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(eventDrivenBad, "OAS").components.PatternRuntime ?? 0
    );
  });

  test("OAS keeps partial family runtime schemas observable and degrades confidence on mismatches", async () => {
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_THIN_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const mismatchResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_FAMILY_MISMATCH_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );

    const thinOas = getMetric(thinResponse, "OAS");
    const mismatchOas = getMetric(mismatchResponse, "OAS");

    expect(thinOas.unknowns.some((entry) => entry.includes("serviceBasedRuntime"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("legacy score"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("patternFamily=microservices"))).toBe(true);
    expect(mismatchOas.components.PatternRuntime ?? 0).toBeGreaterThan(0.8);
    expect(mismatchOas.confidence).toBeLessThan(0.85);
  });

  test("OAS also derives PatternRuntime from raw family-specific runtime observations", async () => {
    const layeredGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_LAYERED_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const layeredBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_LAYERED_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const microservicesGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const microservicesBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const cqrsGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_CQRS_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const cqrsBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_CQRS_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const eventDrivenGood = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_EVENT_DRIVEN_GOOD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const eventDrivenBad = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_EVENT_DRIVEN_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    expect(getMetric(layeredGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(layeredBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(microservicesGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(microservicesBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(cqrsGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(cqrsBad, "OAS").components.PatternRuntime ?? 0
    );
    expect(getMetric(eventDrivenGood, "OAS").components.PatternRuntime ?? 0).toBeGreaterThan(
      getMetric(eventDrivenBad, "OAS").components.PatternRuntime ?? 0
    );
  });

  test("OAS keeps raw pattern runtime partials observable and lets raw runtime override embedded telemetry runtime", async () => {
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_THIN_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const mismatchResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MISMATCH_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const precedenceResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-export": OAS_EXPORT_GOOD_TELEMETRY_PATH,
        "telemetry-normalization-profile": OAS_RAW_PROFILE_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const explicitOverrideResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "telemetry-observations": OAS_GOOD_TELEMETRY_PATH,
        "pattern-runtime-observations": OAS_GOOD_RUNTIME_PATH,
        "pattern-runtime-raw-observations": OAS_RAW_FAMILY_MICROSERVICES_BAD_RUNTIME_PATH,
        "pattern-runtime-normalization-profile": OAS_RAW_PATTERN_RUNTIME_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const thinOas = getMetric(thinResponse, "OAS");
    const mismatchOas = getMetric(mismatchResponse, "OAS");
    const precedenceOas = getMetric(precedenceResponse, "OAS");
    const explicitOverrideOas = getMetric(explicitOverrideResponse, "OAS");

    expect(thinOas.unknowns.some((entry) => entry.includes("serviceBasedRuntime"))).toBe(true);
    expect(mismatchOas.unknowns.some((entry) => entry.includes("patternFamily=cqrs"))).toBe(true);
    expect(mismatchOas.confidence).toBeLessThan(0.85);
    expect(precedenceOas.unknowns.some((entry) => entry.includes("telemetry export 内の patternRuntime は優先されません"))).toBe(true);
    expect(precedenceOas.components.PatternRuntime ?? 1).toBeLessThan(0.5);
    expect(explicitOverrideOas.unknowns.some((entry) => entry.includes("raw pattern runtime input は優先されません"))).toBe(true);
    expect(explicitOverrideOas.components.PatternRuntime ?? 0).toBeGreaterThan(0.8);
  });

  test("TIS is higher for isolated topologies than for shared-dependency topologies", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_GOOD_TOPOLOGY_PATH,
        "runtime-observations": TIS_GOOD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH,
        "runtime-observations": TIS_BAD_RUNTIME_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: TIS_REPO,
        constraints: TIS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "topology-model": TIS_BAD_TOPOLOGY_PATH
      },
      { cwd: process.cwd() }
    );

    const goodTis = getMetric(goodResponse, "TIS");
    const badTis = getMetric(badResponse, "TIS");
    const thinTis = getMetric(thinResponse, "TIS");

    expect(goodTis.value).toBeGreaterThan(badTis.value);
    expect(goodTis.components.FI ?? 0).toBeGreaterThan(badTis.components.FI ?? 0);
    expect(goodTis.components.RC ?? 0).toBeGreaterThan(badTis.components.RC ?? 0);
    expect(badTis.components.SDR ?? 0).toBeGreaterThan(goodTis.components.SDR ?? 0);
    expect(thinTis.unknowns.some((entry) => entry.includes("runtime observation"))).toBe(true);
  });

  test("AELS is higher for architecture histories that stay within boundaries", async () => {
    const localRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels local");
    const scatteredRepo = await materializeGitFixture(AELS_BASE_ENTRY, tempRoots, "feat: init aels scattered");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalOne = 'billing-local-1';\n"
      },
      "feat: billing local 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentLocalOne = 'fulfillment-local-1';\n"
      },
      "feat: fulfillment local 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingLocalTwo = 'billing-local-2';\n"
      },
      "feat: billing local 2"
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossOne = 'billing-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossOne = 'fulfillment-cross-1';\n"
      },
      "feat: cross-boundary 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossTwo = 'billing-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossTwo = 'fulfillment-cross-2';\n"
      },
      "feat: cross-boundary 2"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingCrossThree = 'billing-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentCrossThree = 'fulfillment-cross-3';\n"
      },
      "feat: cross-boundary 3"
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        constraints: AELS_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": AELS_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );

    const localAels = getMetric(localResponse, "AELS");
    const scatteredAels = getMetric(scatteredResponse, "AELS");

    expect(localAels.value).toBeGreaterThan(scatteredAels.value);
    expect(scatteredAels.components.CrossBoundaryCoChange ?? 0).toBeGreaterThan(
      localAels.components.CrossBoundaryCoChange ?? 0
    );
    expect(scatteredAels.components.WeightedPropagationCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedPropagationCost ?? 0
    );
    expect(scatteredAels.components.WeightedClusteringCost ?? 0).toBeGreaterThan(
      localAels.components.WeightedClusteringCost ?? 0
    );
  }, 30000);

  test("EES is higher when delivery and architecture locality are both healthy", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryLocalOne = 'billing-delivery-local-1';\n"
      },
      "feat: billing local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryLocalOne = 'fulfillment-delivery-local-1';\n"
      },
      "feat: fulfillment local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryLocalTwo = 'billing-delivery-local-2';\n"
      },
      "feat: billing local 2"
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossOne = 'billing-delivery-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossOne = 'fulfillment-delivery-cross-1';\n"
      },
      "feat: cross-boundary 1"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossTwo = 'billing-delivery-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossTwo = 'fulfillment-delivery-cross-2';\n"
      },
      "feat: cross-boundary 2"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingDeliveryCrossThree = 'billing-delivery-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentDeliveryCrossThree = 'fulfillment-delivery-cross-3';\n"
      },
      "feat: cross-boundary 3"
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_BAD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH
      },
      { cwd: process.cwd() }
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(goodEes.components.Locality ?? 0).toBeGreaterThan(badEes.components.Locality ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery observations"))).toBe(true);
  }, 30000);

  test("EES also supports raw delivery observations through an explicit normalization profile", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees raw good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees raw bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawDeliveryOne = 'billing-raw-1';\n"
      },
      "feat: boundary-local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRawDeliveryOne = 'fulfillment-raw-1';\n"
      },
      "feat: boundary-local 2"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawDeliveryTwo = 'billing-raw-2';\n"
      },
      "feat: boundary-local 3"
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossOne = 'billing-raw-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRawCrossOne = 'fulfillment-raw-cross-1';\n"
      },
      "feat: raw cross-boundary 1"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossTwo = 'billing-raw-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRawCrossTwo = 'fulfillment-raw-cross-2';\n"
      },
      "feat: raw cross-boundary 2"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRawCrossThree = 'billing-raw-cross-3';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRawCrossThree = 'fulfillment-raw-cross-3';\n"
      },
      "feat: raw cross-boundary 3"
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_GOOD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_THIN_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("raw DeployFrequency"))).toBe(true);
  }, 30000);

  test("EES also supports delivery export bundles through the same normalization path", async () => {
    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees export good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees export bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportLocalOne = 'billing-export-local-1';\n"
      },
      "feat: export local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentExportLocalOne = 'fulfillment-export-local-1';\n"
      },
      "feat: export local 2"
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportCrossOne = 'billing-export-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentExportCrossOne = 'fulfillment-export-cross-1';\n"
      },
      "feat: export cross-boundary 1"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingExportCrossTwo = 'billing-export-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentExportCrossTwo = 'fulfillment-export-cross-2';\n"
      },
      "feat: export cross-boundary 2"
    );

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_GOOD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_THIN_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );

    const goodEes = getMetric(goodResponse, "EES");
    const badEes = getMetric(badResponse, "EES");
    const thinEes = getMetric(thinResponse, "EES");

    expect(goodEes.value).toBeGreaterThan(badEes.value);
    expect(goodEes.components.Delivery ?? 0).toBeGreaterThan(badEes.components.Delivery ?? 0);
    expect(thinEes.unknowns.some((entry) => entry.includes("delivery export"))).toBe(true);
  }, 30000);

  test("EES also supports delivery sources via file and command inputs", async () => {
    await chmod(DATA_FILE_STUB, 0o755);

    const goodRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source good");
    const badRepo = await materializeGitFixture(EES_BASE_ENTRY, tempRoots, "feat: init ees source bad");

    await appendAndCommit(
      goodRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceLocalOne = 'billing-source-local-1';\n"
      },
      "feat: source local 1"
    );
    await appendAndCommit(
      goodRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentSourceLocalOne = 'fulfillment-source-local-1';\n"
      },
      "feat: source local 2"
    );

    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossOne = 'billing-source-cross-1';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentSourceCrossOne = 'fulfillment-source-cross-1';\n"
      },
      "feat: source cross-boundary 1"
    );
    await appendAndCommit(
      badRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingSourceCrossTwo = 'billing-source-cross-2';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentSourceCrossTwo = 'fulfillment-source-cross-2';\n"
      },
      "feat: source cross-boundary 2"
    );

    const goodFileSource = await writeJsonFixture(tempRoots, "ees-good-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH
    });
    const badCommandSource = await writeJsonFixture(tempRoots, "ees-bad-source.json", {
      version: "1.0",
      sourceType: "command",
      command: `${shellQuote(process.execPath)} ${shellQuote(DATA_FILE_STUB)} ${shellQuote(EES_EXPORT_BAD_DELIVERY_PATH)}`
    });
    const thinFileSource = await writeJsonFixture(tempRoots, "ees-thin-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_THIN_DELIVERY_PATH
    });

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": goodFileSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": badCommandSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
    );
    const thinResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-source": thinFileSource,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH
      },
      { cwd: process.cwd() }
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
        "src/billing/internal/billing-service.ts": "\nexport const billingPrecedenceOne = 'billing-precedence-1';\n"
      },
      "feat: precedence local 1"
    );
    await appendAndCommit(
      repo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentPrecedenceOne = 'fulfillment-precedence-1';\n"
      },
      "feat: precedence local 2"
    );

    const goodSource = await writeJsonFixture(tempRoots, "ees-precedence-source.json", {
      version: "1.0",
      sourceType: "file",
      path: EES_EXPORT_GOOD_DELIVERY_PATH
    });

    const normalizedResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-observations": EES_GOOD_DELIVERY_PATH
      },
      { cwd: process.cwd() }
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
        "delivery-source": goodSource
      },
      { cwd: process.cwd() }
    );

    const normalizedEes = getMetric(normalizedResponse, "EES");
    const precedenceEes = getMetric(precedenceResponse, "EES");

    expect(precedenceEes.components.Delivery ?? 0).toBeCloseTo(normalizedEes.components.Delivery ?? 0, 6);
    expect(precedenceEes.unknowns.some((entry) => entry.includes("raw/export/source delivery input は優先されません"))).toBe(true);

    const rawResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-raw-observations": EES_RAW_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource
      },
      { cwd: process.cwd() }
    );
    expect(rawResponse.unknowns.some((entry) => entry.includes("delivery source は利用されません"))).toBe(true);

    const exportResponse = await COMMANDS["score.compute"]!(
      {
        repo,
        constraints: EES_CONSTRAINTS_PATH,
        policy: POLICY_PATH,
        domain: "architecture_design",
        "boundary-map": EES_BOUNDARY_MAP_PATH,
        "delivery-export": EES_EXPORT_BAD_DELIVERY_PATH,
        "delivery-normalization-profile": EES_RAW_PROFILE_PATH,
        "delivery-source": goodSource
      },
      { cwd: process.cwd() }
    );
    expect(exportResponse.unknowns.some((entry) => entry.includes("delivery source は利用されません"))).toBe(true);
  }, 30000);

  test("ELS is higher for localized histories than for scattered histories", async () => {
    const localRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init local history");
    const scatteredRepo = await materializeGitFixture(ELS_BASE_ENTRY, tempRoots, "feat: init scattered history");

    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionOne = 'billing-1';\n"
      },
      "feat: billing update 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentRevisionOne = 'fulfillment-1';\n"
      },
      "feat: fulfillment update 1"
    );
    await appendAndCommit(
      localRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingRevisionTwo = 'billing-2';\n"
      },
      "feat: billing update 2"
    );

    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterOne = 'billing-a';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterOne = 'fulfillment-a';\n"
      },
      "feat: cross-context update 1"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterTwo = 'billing-b';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterTwo = 'fulfillment-b';\n"
      },
      "feat: cross-context update 2"
    );
    await appendAndCommit(
      scatteredRepo,
      {
        "src/billing/internal/billing-service.ts": "\nexport const billingScatterThree = 'billing-c';\n",
        "src/fulfillment/internal/fulfillment-service.ts": "\nexport const fulfillmentScatterThree = 'fulfillment-c';\n"
      },
      "feat: cross-context update 3"
    );

    const localResponse = await COMMANDS["score.compute"]!(
      {
        repo: localRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );
    const scatteredResponse = await COMMANDS["score.compute"]!(
      {
        repo: scatteredRepo,
        model: ELS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design"
      },
      { cwd: process.cwd() }
    );

    const localEls = getMetric(localResponse, "ELS");
    const scatteredEls = getMetric(scatteredResponse, "ELS");

    expect(localEls.value).toBeGreaterThan(scatteredEls.value);
    expect(localEls.value).toBeGreaterThanOrEqual(0.7);
    expect(scatteredEls.value).toBeLessThanOrEqual(0.1);
  }, 20000);

  test("ULI is higher for well-traced glossary terms than for untraced or colliding terms", async () => {
    await chmod(CODEX_STUB, 0o755);

    const goodRoot = await createTemporaryWorkspace([ULI_GOOD_ENTRY]);
    const badTraceRoot = await createTemporaryWorkspace([ULI_BAD_TRACE_ENTRY]);
    tempRoots.push(goodRoot, badTraceRoot);

    const goodRepo = path.join(goodRoot, ULI_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, ULI_GOOD_ENTRY, "docs");
    const badTraceRepo = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "repo");
    const badTraceDocs = path.join(badTraceRoot, ULI_BAD_TRACE_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init uli good");
    await initializeTemporaryGitRepo(badTraceRepo, "feat: init uli bad trace");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badTraceResponse = await COMMANDS["score.compute"]!(
      {
        repo: badTraceRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badTraceDocs
      },
      { cwd: process.cwd() }
    );
    const badCollisionResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: ULI_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs,
        extractor: "cli",
        provider: "codex",
        "provider-cmd": CODEX_STUB,
        fallback: "none"
      },
      { cwd: process.cwd() }
    );

    const goodUli = getMetric(goodResponse, "ULI");
    const badTraceUli = getMetric(badTraceResponse, "ULI");
    const badCollisionUli = getMetric(badCollisionResponse, "ULI");

    expect(goodUli.value).toBeGreaterThan(badTraceUli.value);
    expect(goodUli.value).toBeGreaterThan(badCollisionUli.value);
    expect(goodUli.components.TL ?? 0).toBeGreaterThan(badTraceUli.components.TL ?? 0);
    expect(badCollisionUli.components.TC ?? 0).toBeGreaterThan(goodUli.components.TC ?? 0);
  }, 15000);

  test("DRF is higher for explicit rules and invariants than for ambiguous documents", async () => {
    const goodRoot = await createTemporaryWorkspace([DRF_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([DRF_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, DRF_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, DRF_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, DRF_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, DRF_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init drf good");
    await initializeTemporaryGitRepo(badRepo, "feat: init drf bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: DRF_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodDrf = getMetric(goodResponse, "DRF");
    const badDrf = getMetric(badResponse, "DRF");

    expect(goodDrf.value).toBeGreaterThan(badDrf.value);
    expect(goodDrf.components.RC ?? 0).toBeGreaterThan(badDrf.components.RC ?? 0);
    expect(goodDrf.components.RA ?? 0).toBeGreaterThan(badDrf.components.RA ?? 0);
    expect(badDrf.unknowns).toContain("SC は use case signal ベースの近似です");
  }, 15000);

  test("BFS is higher for context-localized documents than for misaligned shared-boundary documents", async () => {
    const goodRoot = await createTemporaryWorkspace([BFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([BFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, BFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, BFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, BFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, BFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init bfs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init bfs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: BFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodBfs = getMetric(goodResponse, "BFS");
    const badBfs = getMetric(badResponse, "BFS");

    expect(goodBfs.value).toBeGreaterThan(badBfs.value);
    expect(goodBfs.components.A ?? 0).toBeGreaterThan(badBfs.components.A ?? 0);
    expect(goodBfs.components.R ?? 0).toBeGreaterThanOrEqual(badBfs.components.R ?? 0);
  }, 15000);

  test("AFS is higher for localized invariants than for cross-context transaction invariants", async () => {
    const goodRoot = await createTemporaryWorkspace([AFS_GOOD_ENTRY]);
    const badRoot = await createTemporaryWorkspace([AFS_BAD_ENTRY]);
    tempRoots.push(goodRoot, badRoot);

    const goodRepo = path.join(goodRoot, AFS_GOOD_ENTRY, "repo");
    const goodDocs = path.join(goodRoot, AFS_GOOD_ENTRY, "docs");
    const badRepo = path.join(badRoot, AFS_BAD_ENTRY, "repo");
    const badDocs = path.join(badRoot, AFS_BAD_ENTRY, "docs");

    await initializeTemporaryGitRepo(goodRepo, "feat: init afs good");
    await initializeTemporaryGitRepo(badRepo, "feat: init afs bad");

    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: goodRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": goodDocs
      },
      { cwd: process.cwd() }
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: badRepo,
        model: AFS_MODEL_PATH,
        policy: POLICY_PATH,
        domain: "domain_design",
        "docs-root": badDocs
      },
      { cwd: process.cwd() }
    );

    const goodAfs = getMetric(goodResponse, "AFS");
    const badAfs = getMetric(badResponse, "AFS");

    expect(goodAfs.value).toBeGreaterThan(badAfs.value);
    expect(goodAfs.components.SIC ?? 0).toBeGreaterThan(badAfs.components.SIC ?? 0);
    expect(badAfs.components.XTC ?? 0).toBeGreaterThan(goodAfs.components.XTC ?? 0);
    expect(goodAfs.unknowns).toContain("Aggregate 定義がないため context を aggregate proxy として扱っています");
  }, 15000);
});

async function materializeGitFixture(
  entry: string,
  tempRoots: string[],
  initialCommitMessage: string
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([entry]);
  tempRoots.push(tempRoot);
  const repoPath = path.join(tempRoot, entry);
  await initializeTemporaryGitRepo(repoPath, initialCommitMessage);
  return repoPath;
}

async function appendAndCommit(
  repoPath: string,
  updates: Record<string, string>,
  message: string
): Promise<void> {
  for (const [relativePath, content] of Object.entries(updates)) {
    const targetPath = path.join(repoPath, relativePath);
    const current = await readFile(targetPath, "utf8");
    await writeFile(targetPath, `${current}${content}`, "utf8");
  }

  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    [
      "-c",
      "user.email=tester@example.com",
      "-c",
      "user.name=Context Probe Tester",
      "commit",
      "-m",
      message
    ],
    { cwd: repoPath }
  );
}

async function writeJsonFixture<T>(
  tempRoots: string[],
  fileName: string,
  payload: T
): Promise<string> {
  const tempRoot = await createTemporaryWorkspace([]);
  tempRoots.push(tempRoot);
  const targetPath = path.join(tempRoot, fileName);
  await writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function getMetric(
  response: Awaited<ReturnType<NonNullable<typeof COMMANDS["score.compute"]>>>,
  metricId: string
) {
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

function computeApsiFromWeights(
  components: Record<string, number>,
  weights: { QSF: number; PCS: number; OAS: number; EES: number; CTI: number }
): number {
  return (
    weights.QSF * (components.QSF ?? 0.5) +
    weights.PCS * (components.PCS ?? 0.5) +
    weights.OAS * (components.OAS ?? 0.5) +
    weights.EES * (components.EES ?? 0.5) +
    weights.CTI * (1 - (components.CTI ?? 0.5))
  );
}
