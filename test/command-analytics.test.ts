import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  appendCommandEventLog,
  readAndSummarizeCommandEventLog,
  resolveCommandSessionId,
} from "../src/core/command-analytics.js";
import { createResponse } from "../src/core/response.js";
import { metric } from "./report-gate.helpers.js";

describe("command analytics", () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempPaths.map(async (entry) => {
        await import("node:fs/promises").then(({ rm }) => rm(entry, { recursive: true, force: true }));
      }),
    );
  });

  test("does not write an event log when the env var is absent", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-analytics-"));
    tempPaths.push(tempRoot);
    const logPath = path.join(tempRoot, "events.jsonl");

    await appendCommandEventLog({
      env: {},
      command: "score.compute",
      repoPath: tempRoot,
      durationMs: 42,
      response: createResponse({ domainId: "domain_design", metrics: [metric({ metricId: "MCCS", value: 0.9 })] }),
      sessionId: resolveCommandSessionId({}),
    });

    await expect(readFile(logPath, "utf8")).rejects.toThrow();
  });

  test("writes JSONL entries and summarizes follow-up rate when enabled", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "context-probe-analytics-"));
    tempPaths.push(tempRoot);
    const logPath = path.join(tempRoot, "events.jsonl");
    const env = { CONTEXT_PROBE_EVENT_LOG: logPath, CONTEXT_PROBE_SESSION_ID: "session-1" };
    const scoreResponse = createResponse({
      domainId: "architecture_design",
      metrics: [
        metric({ metricId: "QSF", value: 0.6, unknowns: ["QSF is a conservative approximation."] }),
        metric({ metricId: "DDS", value: 0.9 }),
      ],
    });

    await appendCommandEventLog({
      env,
      command: "score.compute",
      repoPath: tempRoot,
      durationMs: 120,
      response: scoreResponse,
      sessionId: "session-1",
    });
    await appendCommandEventLog({
      env,
      command: "report.generate",
      repoPath: tempRoot,
      durationMs: 20,
      response: createResponse(
        { format: "md", report: "# ok" },
        {
          confidence: scoreResponse.confidence,
          ...(scoreResponse.meta ? { meta: scoreResponse.meta } : {}),
        },
      ),
      sessionId: "session-1",
    });

    const summary = await readAndSummarizeCommandEventLog(logPath);
    const raw = await readFile(logPath, "utf8");

    expect(raw.trim().split("\n")).toHaveLength(2);
    expect(summary.commandMix["score.compute"]).toBe(1);
    expect(summary.commandMix["report.generate"]).toBe(1);
    expect(summary.averageProxyRate).toBeGreaterThan(0);
    expect(summary.followUpRate).toBe(1);
  });
});
