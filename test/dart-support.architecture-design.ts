import { expect, test } from "vitest";

import { scoreInterfaceProtocolStability } from "../src/analyzers/architecture-contracts.js";
import { scoreBoundaryPurity } from "../src/analyzers/architecture-purity.js";
import { parseCodebase } from "../src/analyzers/code.js";
import { scoreComplexityTax } from "../src/analyzers/cti.js";
import { COMMANDS } from "../src/commands.js";
import { loadArchitectureConstraints } from "../src/core/model.js";

import {
  DART_ARCHITECTURE_BAD_REPO,
  DART_ARCHITECTURE_CONSTRAINTS,
  DART_ARCHITECTURE_GOOD_REPO,
  FLUTTER_HEURISTIC_CONSTRAINTS,
  FLUTTER_HEURISTIC_REPO,
  getMetric,
  POLICY_PATH,
} from "./dart-support.helpers.js";

export function registerDartSupportArchitectureDesignTests(): void {
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
}
