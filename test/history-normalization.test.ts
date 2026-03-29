import { promisify } from "node:util";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { PolicyConfig } from "../src/core/contracts.js";

const POLICY: PolicyConfig = {
  profiles: {
    default: {
      domains: {}
    }
  }
};

describe("history normalization", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("node:child_process");
  });

  test("uses an expanded exec buffer for large git histories", async () => {
    const execFilePromisified = vi.fn(async () => ({
      stdout: "__COMMIT__\nabc123\nfeat: sample commit\nM\tsrc/billing/invoice.ts\n",
      stderr: ""
    }));
    const execFileMock = vi.fn();
    Object.assign(execFileMock, {
      [promisify.custom]: execFilePromisified
    });

    vi.doMock("node:child_process", () => ({
      execFile: execFileMock
    }));

    const { normalizeHistory } = await import("../src/core/history.js");
    const commits = await normalizeHistory("/tmp/example-repo", POLICY, "default");

    expect(commits).toHaveLength(1);
    expect(execFilePromisified).toHaveBeenCalledTimes(1);
    const firstCall = execFilePromisified.mock.calls[0] as
      | [string, string[], { cwd?: string; maxBuffer?: number }]
      | undefined;
    expect(firstCall).toBeDefined();
    const [command, args, options] = firstCall!;
    expect(command).toBe("git");
    expect(args).toEqual(expect.arrayContaining(["-C", "/tmp/example-repo", "log", "--name-status"]));
    expect(options).toEqual(
      expect.objectContaining({
        cwd: "/tmp/example-repo",
        maxBuffer: 64 * 1024 * 1024
      })
    );
  });
});
