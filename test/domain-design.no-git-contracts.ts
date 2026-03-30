import path from "node:path";

import { expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { createTemporaryWorkspace } from "./helpers.js";
import { MODEL_ENTRY, POLICY_PATH, PROJECT_ENTRIES } from "./self-measurement.shared.js";

function progressShape(progress: Array<{ phase: string; message: string }>): string[] {
  return progress.map((entry) => `${entry.phase}:${entry.message.replace(/ completed in \d+(?:ms|s)\.$/, " completed.")}`);
}

export function registerDomainDesignNoGitContractTests(state: DomainDesignTestState): void {
  test("score.compute reports a history diagnostics trail when git metadata is absent", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const response = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    expect(response.status).toBe("warning");
    expect(response.diagnostics.some((entry) => entry.includes("Skipped history analysis"))).toBe(true);
    expect(response.unknowns).toContain("Git information required for history analysis is missing.");
    expect(response.progress.some((entry) => entry.phase === "domain_design")).toBe(true);
    expect(response.progress.some((entry) => entry.phase === "history")).toBe(true);
  });

  test("report.generate preserves no-git diagnostics and unknowns in markdown output", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const scoreResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const reportResponse = await COMMANDS["report.generate"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
        format: "md",
      },
      { cwd: process.cwd() },
    );

    const reportResult = reportResponse.result as {
      format: string;
      report: string;
    };

    expect(reportResponse.status).toBe(scoreResponse.status);
    expect(reportResponse.unknowns).toEqual(scoreResponse.unknowns);
    expect(reportResponse.diagnostics).toEqual(scoreResponse.diagnostics);
    expect(progressShape(reportResponse.progress)).toEqual(progressShape(scoreResponse.progress));
    expect(reportResult.format).toBe("md");
    expect(reportResult.report).toContain("## Diagnostics");
    expect(reportResult.report).toContain("Skipped history analysis");
    expect(reportResult.report).toContain("Git information required for history analysis is missing.");
  });

  test("gate.evaluate preserves the same no-git unknowns while adding gate diagnostics", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const scoreResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const gateResponse = await COMMANDS["gate.evaluate"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );

    const gateResult = gateResponse.result as {
      domainId: string;
      gate: { status: "ok" | "warning" | "error"; failures: string[]; warnings: string[] };
      metrics: Array<{ metricId: string; value: number }>;
    };

    expect(gateResult.domainId).toBe("domain_design");
    expect(gateResponse.unknowns).toEqual(scoreResponse.unknowns);
    expect(gateResponse.diagnostics.some((entry) => entry.includes("Skipped history analysis"))).toBe(true);
    expect(gateResponse.diagnostics.some((entry) => entry.startsWith("Available packs: "))).toBe(true);
    expect(progressShape(gateResponse.progress)).toEqual(progressShape(scoreResponse.progress));
    expect(gateResponse.status).toBe(gateResult.gate.status);
    expect(gateResult.metrics.map((metric) => metric.metricId)).toEqual(expect.arrayContaining(["ELS", "MCCS"]));
  });

  test("review.list_unknowns keeps the score.compute diagnostics trail intact", async () => {
    const repoPath = await createTemporaryWorkspace(PROJECT_ENTRIES);
    state.repoPath = repoPath;

    const scoreResponse = await COMMANDS["score.compute"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
      },
      { cwd: process.cwd() },
    );
    const reviewResponse = await COMMANDS["review.list_unknowns"]!(
      {
        repo: repoPath,
        model: path.join(repoPath, MODEL_ENTRY),
        policy: POLICY_PATH,
        domain: "domain_design",
        "source-command": "score.compute",
      },
      { cwd: process.cwd() },
    );

    const reviewResult = reviewResponse.result as {
      reviewItems: Array<{ summary: string }>;
    };

    expect(reviewResponse.unknowns).toEqual(scoreResponse.unknowns);
    expect(reviewResponse.diagnostics).toEqual(scoreResponse.diagnostics);
    expect(progressShape(reviewResponse.progress)).toEqual(progressShape(scoreResponse.progress));
    expect(reviewResult.reviewItems.length).toBeGreaterThan(0);
    expect(reviewResult.reviewItems.map((item) => item.summary).join("\n")).toContain("history");
  });
}
