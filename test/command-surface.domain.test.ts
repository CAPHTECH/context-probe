import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CONTEXT, DOMAIN_MODEL_PATH } from "./command-surface.helpers.js";

describe("command surface domain helpers", () => {
  test("artifact helper commands operate against the repository self-measurement inputs", async () => {
    const artifacts = await COMMANDS["ingest.register_artifacts"]!({}, CONTEXT);
    const fragments = await COMMANDS["ingest.normalize_documents"]!({ "docs-root": "docs" }, CONTEXT);

    expect((artifacts.result as { artifacts: unknown[] }).artifacts.length).toBeGreaterThan(0);
    expect((fragments.result as { fragments: unknown[] }).fragments.length).toBeGreaterThan(0);
  }, 30000);

  test("code helper commands operate against the repository self-measurement inputs", async () => {
    const dependencies = await COMMANDS["code.detect_dependencies"]!({ repo: "." }, CONTEXT);
    const modelLinks = await COMMANDS["trace.link_model_to_code"]!({ repo: ".", model: DOMAIN_MODEL_PATH }, CONTEXT);

    expect((dependencies.result as { dependencies: unknown[] }).dependencies.length).toBeGreaterThan(0);
    expect((modelLinks.result as { links: unknown[] }).links.length).toBeGreaterThan(0);
  }, 60000);

  test("trace helper commands operate against the repository self-measurement inputs", async () => {
    const tracedTerms = await COMMANDS["trace.link_terms"]!({ repo: ".", "docs-root": "docs" }, CONTEXT);

    expect((tracedTerms.result as { links: unknown[] }).links.length).toBeGreaterThan(0);
  }, 60000);

  test("model scaffold operates without docs against the repository self-measurement inputs", async () => {
    const scaffoldWithoutDocs = await COMMANDS["model.scaffold"]!({ repo: "." }, CONTEXT);

    expect((scaffoldWithoutDocs.result as { contexts: unknown[] }).contexts.length).toBeGreaterThan(0);
  }, 60000);

  test("model scaffold operates with docs against the repository self-measurement inputs", async () => {
    const scaffoldWithDocs = await COMMANDS["model.scaffold"]!({ repo: ".", "docs-root": "docs" }, CONTEXT);

    expect((scaffoldWithDocs.result as { contexts: unknown[] }).contexts.length).toBeGreaterThan(0);
  }, 180000);

  test("domain helper commands surface contract and boundary usage independently", async () => {
    const contractUsage = await COMMANDS["code.detect_contract_usage"]!(
      { repo: ".", model: DOMAIN_MODEL_PATH },
      CONTEXT,
    );
    const boundaryLeaks = await COMMANDS["code.detect_boundary_leaks"]!(
      { repo: ".", model: DOMAIN_MODEL_PATH },
      CONTEXT,
    );

    expect((contractUsage.result as { applicableReferences?: number }).applicableReferences).toBeGreaterThanOrEqual(0);
    expect(Array.isArray((boundaryLeaks.result as { findings: unknown[] }).findings)).toBe(true);
  }, 20000);
});
