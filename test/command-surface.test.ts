import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS, listCommands, maybeWriteOutput } from "../src/commands.js";
import type { CommandContext } from "../src/core/contracts.js";
import { createResponse } from "../src/core/response.js";

const REPO_ROOT = process.cwd();
const CONTEXT: CommandContext = { cwd: REPO_ROOT };
const DOMAIN_MODEL_PATH = path.resolve("config/self-measurement/domain-model.yaml");
const ARCHITECTURE_CONSTRAINTS_PATH = path.resolve("config/self-measurement/architecture-constraints.yaml");

describe("command surface", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dirPath) => {
        await import("node:fs/promises").then(({ rm }) => rm(dirPath, { recursive: true, force: true }));
      }),
    );
  });

  test("listCommands includes sorted domain and architecture command families", () => {
    const commands = listCommands();

    expect(commands).toEqual([...commands].sort());
    expect(commands).toContain("ingest.register_artifacts");
    expect(commands).toContain("trace.link_model_to_code");
    expect(commands).toContain("arch.load_topology");
    expect(commands).toContain("score.compute");
  });

  test("maybeWriteOutput persists a command response only when output is requested", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-command-output-"));
    tempDirs.push(tempDir);

    const outputPath = path.join(tempDir, "response.json");
    const response = createResponse({ saved: true });

    await maybeWriteOutput(response, { output: outputPath }, CONTEXT);

    const saved = JSON.parse(await readFile(outputPath, "utf8"));
    expect(saved).toEqual(response);

    const untouchedPath = path.join(tempDir, "untouched.json");
    await maybeWriteOutput(response, {}, CONTEXT);
    await expect(readFile(untouchedPath, "utf8")).rejects.toThrow();
  });

  test("domain helper commands operate against the repository self-measurement inputs", async () => {
    const artifacts = await COMMANDS["ingest.register_artifacts"]!({}, CONTEXT);
    const fragments = await COMMANDS["ingest.normalize_documents"]!({ "docs-root": "docs" }, CONTEXT);
    const dependencies = await COMMANDS["code.detect_dependencies"]!({ repo: "." }, CONTEXT);
    const modelLinks = await COMMANDS["trace.link_model_to_code"]!({ repo: ".", model: DOMAIN_MODEL_PATH }, CONTEXT);
    const contractUsage = await COMMANDS["code.detect_contract_usage"]!(
      { repo: ".", model: DOMAIN_MODEL_PATH },
      CONTEXT,
    );
    const boundaryLeaks = await COMMANDS["code.detect_boundary_leaks"]!(
      { repo: ".", model: DOMAIN_MODEL_PATH },
      CONTEXT,
    );

    expect((artifacts.result as { artifacts: unknown[] }).artifacts.length).toBeGreaterThan(0);
    expect((fragments.result as { fragments: unknown[] }).fragments.length).toBeGreaterThan(0);
    expect((dependencies.result as { dependencies: unknown[] }).dependencies.length).toBeGreaterThan(0);
    expect((modelLinks.result as { links: unknown[] }).links.length).toBeGreaterThan(0);
    expect((contractUsage.result as { applicableReferences?: number }).applicableReferences).toBeGreaterThanOrEqual(0);
    expect(Array.isArray((boundaryLeaks.result as { findings: unknown[] }).findings)).toBe(true);
  });

  test("architecture helper commands operate against the repository self-measurement inputs", async () => {
    const topology = await COMMANDS["arch.load_topology"]!({ constraints: ARCHITECTURE_CONSTRAINTS_PATH }, CONTEXT);
    const direction = await COMMANDS["arch.score_dependency_direction"]!(
      { repo: ".", constraints: ARCHITECTURE_CONSTRAINTS_PATH },
      CONTEXT,
    );
    const violations = await COMMANDS["arch.detect_direction_violations"]!(
      { repo: ".", constraints: ARCHITECTURE_CONSTRAINTS_PATH },
      CONTEXT,
    );

    expect((topology.result as { layers: unknown[] }).layers.length).toBeGreaterThan(0);
    expect((direction.result as { IDR?: number }).IDR).toBeGreaterThanOrEqual(0);
    expect(Array.isArray((violations.result as { violations: unknown[] }).violations)).toBe(true);
  });

  test("review.list_unknowns accepts both input files and source-command delegation", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-probe-review-"));
    tempDirs.push(tempDir);

    const scorePath = path.join(tempDir, "score.json");
    const scoreResponse = await COMMANDS["score.compute"]!(
      {
        domain: "architecture_design",
        repo: ".",
        constraints: ARCHITECTURE_CONSTRAINTS_PATH,
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      CONTEXT,
    );

    await maybeWriteOutput(scoreResponse, { output: scorePath }, CONTEXT);

    const fromInput = await COMMANDS["review.list_unknowns"]!({ input: scorePath }, CONTEXT);
    const fromSourceCommand = await COMMANDS["review.list_unknowns"]!(
      {
        "source-command": "score.compute",
        domain: "architecture_design",
        repo: ".",
        constraints: ARCHITECTURE_CONSTRAINTS_PATH,
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      CONTEXT,
    );

    expect((fromInput.result as { reviewItems: unknown[] }).reviewItems.length).toBeGreaterThanOrEqual(0);
    expect((fromSourceCommand.result as { reviewItems: unknown[] }).reviewItems.length).toBeGreaterThanOrEqual(0);
    expect(fromSourceCommand.unknowns).toEqual(scoreResponse.unknowns);
  });

  test("history commands honor policy/profile inputs and review.resolve enforces required paths", async () => {
    const normalized = await COMMANDS["ingest.normalize_history"]!(
      {
        repo: ".",
        policy: path.resolve("fixtures/policies/default.yaml"),
        profile: "layered",
      },
      CONTEXT,
    );
    const locality = await COMMANDS["history.score_evolution_locality"]!(
      {
        repo: ".",
        model: DOMAIN_MODEL_PATH,
        policy: path.resolve("fixtures/policies/default.yaml"),
      },
      CONTEXT,
    );

    expect(((normalized.result as { commits: unknown[] }).commits ?? []).length).toBeGreaterThan(0);
    expect(locality.confidence).toBeGreaterThan(0);
    await expect(COMMANDS["review.resolve"]!({}, CONTEXT)).rejects.toThrow(
      "`--review-items` and `--resolutions` are required",
    );
  });
});
