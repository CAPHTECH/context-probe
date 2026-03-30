import path from "node:path";

import { describe, expect, test } from "vitest";
import { loadArchitectureConstraints, loadDomainModel } from "../src/core/model.js";
import { DEFAULT_POLICY, getDomainPolicy, loadPolicyConfig } from "../src/core/policy.js";
import { normalizeProviderPayload } from "../src/core/providers-normalization.js";
import { createDefaultExtractionOptions } from "../src/core/scaffold-options.js";
import * as publicApi from "../src/index.js";

describe("core utility coverage", () => {
  test("public index exposes the main CLI-facing surface", () => {
    expect(publicApi.COMMANDS).toBeDefined();
    expect(publicApi.listCommands).toBeTypeOf("function");
    expect(publicApi.maybeWriteOutput).toBeTypeOf("function");
    expect(publicApi.DEFAULT_POLICY).toBeDefined();
    expect(publicApi.renderMarkdownReport).toBeTypeOf("function");
  });

  test("createDefaultExtractionOptions returns the documented heuristic defaults", () => {
    expect(createDefaultExtractionOptions("/tmp/docs", "/tmp/repo")).toEqual({
      root: "/tmp/docs",
      cwd: "/tmp/repo",
      extractor: "heuristic",
      promptProfile: "default",
      fallback: "heuristic",
      applyReviewLog: false,
    });
  });

  test("normalizeProviderPayload handles array and object forms and rejects invalid payloads", () => {
    expect(normalizeProviderPayload([{ provider: "test" }, null, 1])).toEqual({
      items: [{ provider: "test" }],
      confidence: 0.7,
      unknowns: [],
      diagnostics: [],
    });

    expect(
      normalizeProviderPayload({
        result: {
          items: [{ provider: "nested" }, "skip"],
          confidence: 0.9,
          unknowns: ["u1", 2],
          diagnostics: ["d1", false],
        },
      }),
    ).toEqual({
      items: [{ provider: "nested" }],
      confidence: 0.9,
      unknowns: ["u1"],
      diagnostics: ["d1"],
    });

    expect(() => normalizeProviderPayload("invalid")).toThrow("Provider output was not a JSON object");
  });

  test("policy loading and domain lookup cover both default and explicit policy paths", async () => {
    const loadedDefault = await loadPolicyConfig();
    const loadedFixture = await loadPolicyConfig(path.resolve("fixtures/policies/default.yaml"));
    const defaultProfile = DEFAULT_POLICY.profiles.default;

    expect(loadedDefault).toEqual(DEFAULT_POLICY);
    expect(Object.keys(loadedFixture.profiles)).toContain("default");
    expect(defaultProfile).toBeDefined();
    expect(getDomainPolicy(DEFAULT_POLICY, "default", "domain_design")).toEqual(defaultProfile!.domains.domain_design);
    expect(getDomainPolicy(loadedFixture, "default", "domain_design").metrics.MCCS?.formula).toContain("MRP");
    expect(() => getDomainPolicy(DEFAULT_POLICY, "missing", "domain_design")).toThrow("Unknown policy profile");
    expect(() => getDomainPolicy(DEFAULT_POLICY, "default", "missing_domain")).toThrow("Unknown domain policy");
  });

  test("model loaders validate aggregate and architecture constraints contracts", async () => {
    const domainTempPath = path.resolve("config/self-measurement/domain-model.yaml");
    const architecturePath = path.resolve("config/self-measurement/architecture-constraints.yaml");

    const model = await loadDomainModel(domainTempPath);
    const constraints = await loadArchitectureConstraints(architecturePath);

    expect(model.contexts.length).toBeGreaterThan(0);
    expect(constraints.layers.length).toBeGreaterThan(0);
  });
});
