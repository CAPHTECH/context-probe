import path from "node:path";

import { describe, expect, test } from "vitest";

import { scoreInterfaceProtocolStability } from "../src/analyzers/architecture-contracts.js";
import { scoreBoundaryPurity } from "../src/analyzers/architecture-purity.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "../src/analyzers/code.js";
import { scoreComplexityTax } from "../src/analyzers/cti.js";
import { COMMANDS } from "../src/commands.js";
import { registerArtifacts } from "../src/core/artifacts.js";
import type { CommandResponse, GlossaryTerm, MetricScore } from "../src/core/contracts.js";
import { loadArchitectureConstraints, loadDomainModel } from "../src/core/model.js";
import { buildTermTraceLinks } from "../src/core/trace.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const PARSER_REPO = path.resolve("fixtures/dart-support/parser-repo");
const DART_DOMAIN_MODEL = path.resolve("fixtures/dart-support/domain-design/model.yaml");
const DART_DOMAIN_GOOD_REPO = path.resolve("fixtures/dart-support/domain-design/good-repo");
const DART_DOMAIN_BAD_REPO = path.resolve("fixtures/dart-support/domain-design/bad-repo");
const DART_ARCHITECTURE_CONSTRAINTS = path.resolve("fixtures/dart-support/architecture-design/constraints.yaml");
const DART_ARCHITECTURE_GOOD_REPO = path.resolve("fixtures/dart-support/architecture-design/good-repo");
const DART_ARCHITECTURE_BAD_REPO = path.resolve("fixtures/dart-support/architecture-design/bad-repo");
const FLUTTER_HEURISTIC_CONSTRAINTS = path.resolve("fixtures/dart-support/flutter-heuristics/constraints.yaml");
const FLUTTER_HEURISTIC_REPO = path.resolve("fixtures/dart-support/flutter-heuristics/repo");

function getMetric(response: CommandResponse<unknown>, metricId: string): MetricScore {
  const result = response.result as { metrics: MetricScore[] };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`metric ${metricId} not found`);
  }
  return metric;
}

describe("dart support", () => {
  test("parses Dart imports, exports, parts, package URIs, and mixed-language files", async () => {
    const codebase = await parseCodebase(PARSER_REPO);

    expect(codebase.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "lib/application/load_order.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "../contracts/order_contract.dart",
          targetKind: "file",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/application/use_case.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "package:parser_repo/contracts/order_contract.dart",
          targetKind: "file",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/infrastructure/json_codec.dart",
          target: "dart:convert",
          specifier: "dart:convert",
          targetKind: "external",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/contracts/contracts.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "order_contract.dart",
          targetKind: "file",
          kind: "export",
        }),
        expect.objectContaining({
          source: "lib/models/order.dart",
          target: "lib/models/order.g.dart",
          specifier: "order.g.dart",
          targetKind: "file",
          kind: "part",
        }),
        expect.objectContaining({
          source: "lib/application/missing_dep.dart",
          target: "../contracts/missing_contract.dart",
          specifier: "../contracts/missing_contract.dart",
          targetKind: "missing",
          kind: "import",
        }),
      ]),
    );

    expect(codebase.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "lib/models/order.g.dart",
          language: "dart",
          generated: true,
          libraryRole: "part",
        }),
        expect.objectContaining({
          path: "src/bridge.ts",
          language: "typescript",
          generated: false,
        }),
      ]),
    );
    expect(codebase.scorableSourceFiles).not.toContain("lib/models/order.g.dart");
    expect(codebase.scorableSourceFiles).toContain("lib/models/order.dart");
    expect(codebase.scorableSourceFiles).toContain("src/bridge.ts");
  });

  test("treats Dart files as source artifacts and excludes generated Dart files from trace hits", async () => {
    const artifacts = await registerArtifacts(PARSER_REPO);
    const codebase = await parseCodebase(PARSER_REPO);
    const terms: GlossaryTerm[] = [
      {
        termId: "TERM-ORDER-CONTRACT",
        canonicalTerm: "OrderContract",
        aliases: [],
        count: 1,
        collision: false,
        confidence: 1,
        evidence: [],
        unknowns: [],
        fragmentIds: [],
      },
      {
        termId: "TERM-GENERATED-ONLY",
        canonicalTerm: "GeneratedOnly",
        aliases: [],
        count: 1,
        collision: false,
        confidence: 1,
        evidence: [],
        unknowns: [],
        fragmentIds: [],
      },
    ];

    expect(artifacts.find((artifact) => artifact.path === "lib/contracts/order_contract.dart")?.type).toBe(
      "source_code",
    );

    const links = await buildTermTraceLinks({
      docsRoot: path.join(PARSER_REPO, "docs"),
      repoRoot: PARSER_REPO,
      codeFiles: codebase.scorableSourceFiles,
      terms,
    });

    expect(links.find((link) => link.canonicalTerm === "OrderContract")?.coverage.codeHits).toBeGreaterThan(0);
    expect(links.find((link) => link.canonicalTerm === "GeneratedOnly")?.coverage.codeHits).toBe(0);
  });

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

    expect(goodResponse.status).not.toBe("error");
    expect(badResponse.status).not.toBe("error");
    expect(getMetric(goodResponse, "MCCS").value).toBeGreaterThan(getMetric(badResponse, "MCCS").value);
  });

  test("computes Dart architecture scores across DDS, BPS, IPS, and CTI", async () => {
    const goodResponse = await COMMANDS["score.compute"]!(
      {
        repo: DART_ARCHITECTURE_GOOD_REPO,
        constraints: DART_ARCHITECTURE_CONSTRAINTS,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );
    const badResponse = await COMMANDS["score.compute"]!(
      {
        repo: DART_ARCHITECTURE_BAD_REPO,
        constraints: DART_ARCHITECTURE_CONSTRAINTS,
        policy: POLICY_PATH,
        domain: "architecture_design",
      },
      { cwd: process.cwd() },
    );

    expect(goodResponse.status).not.toBe("error");
    expect(badResponse.status).not.toBe("error");
    expect(getMetric(goodResponse, "DDS").value).toBeGreaterThan(getMetric(badResponse, "DDS").value);
    expect(getMetric(goodResponse, "BPS").value).toBeGreaterThan(getMetric(badResponse, "BPS").value);
    expect(getMetric(goodResponse, "IPS").value).toBeGreaterThan(getMetric(badResponse, "IPS").value);
    expect(getMetric(goodResponse, "CTI").value).toBeLessThan(getMetric(badResponse, "CTI").value);
  });

  test("uses Flutter-friendly heuristics for domain contracts without misclassifying feature events folders", async () => {
    const constraints = await loadArchitectureConstraints(FLUTTER_HEURISTIC_CONSTRAINTS);
    const codebase = await parseCodebase(FLUTTER_HEURISTIC_REPO);

    const purity = scoreBoundaryPurity(codebase, constraints);
    const protocol = await scoreInterfaceProtocolStability({
      root: FLUTTER_HEURISTIC_REPO,
      codebase,
      constraints,
    });
    const complexity = scoreComplexityTax({
      codebase,
      constraints,
    });

    expect(
      purity.findings.some(
        (finding) =>
          finding.kind === "framework_contamination" &&
          finding.path === "lib/features/entries/domain/entry_repository.dart",
      ),
    ).toBe(false);
    expect(
      purity.findings.some(
        (finding) =>
          finding.kind === "framework_contamination" &&
          finding.path === "lib/features/events/domain/event_repository.dart",
      ),
    ).toBe(false);
    expect(protocol.unknowns).not.toContain("There are too few contract files, so IPS is conservative.");
    expect(
      protocol.findings.some((finding) => finding.path === "lib/features/events/data/supabase_event_repository.dart"),
    ).toBe(false);
    expect(
      protocol.findings.some(
        (finding) => finding.path === "lib/features/events/presentation/event_templates_screen.dart",
      ),
    ).toBe(false);
    expect(complexity.components.ContractsOrSchemasPerService).toBe(0);
  });
});
