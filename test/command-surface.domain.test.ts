import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { CONTEXT, DOMAIN_MODEL_PATH } from "./command-surface.helpers.js";

describe("command surface domain helpers", () => {
  test("domain helper commands operate against the repository self-measurement inputs", async () => {
    const artifacts = await COMMANDS["ingest.register_artifacts"]!({}, CONTEXT);
    const fragments = await COMMANDS["ingest.normalize_documents"]!({ "docs-root": "docs" }, CONTEXT);
    const dependencies = await COMMANDS["code.detect_dependencies"]!({ repo: "." }, CONTEXT);
    const tracedTerms = await COMMANDS["trace.link_terms"]!({ repo: ".", "docs-root": "docs" }, CONTEXT);
    const scaffoldWithoutDocs = await COMMANDS["model.scaffold"]!({ repo: "." }, CONTEXT);
    const scaffoldWithDocs = await COMMANDS["model.scaffold"]!({ repo: ".", "docs-root": "docs" }, CONTEXT);
    const modelLinks = await COMMANDS["trace.link_model_to_code"]!({ repo: ".", model: DOMAIN_MODEL_PATH }, CONTEXT);

    expect((artifacts.result as { artifacts: unknown[] }).artifacts.length).toBeGreaterThan(0);
    expect((fragments.result as { fragments: unknown[] }).fragments.length).toBeGreaterThan(0);
    expect((dependencies.result as { dependencies: unknown[] }).dependencies.length).toBeGreaterThan(0);
    expect((tracedTerms.result as { links: unknown[] }).links.length).toBeGreaterThan(0);
    expect((scaffoldWithoutDocs.result as { contexts: unknown[] }).contexts.length).toBeGreaterThan(0);
    expect((scaffoldWithDocs.result as { contexts: unknown[] }).contexts.length).toBeGreaterThan(0);
    expect((modelLinks.result as { links: unknown[] }).links.length).toBeGreaterThan(0);
  }, 120000);

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
