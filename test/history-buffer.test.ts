import { afterEach, describe, expect, test, vi } from "vitest";

import type { PolicyConfig } from "../src/core/contracts.js";

describe("history buffer configuration", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:child_process");
  });

  test("normalizeHistory raises git log maxBuffer for large repositories", async () => {
    const execFileMock = vi.fn();
    const execFilePromiseMock = vi.fn(async () => ({
      stdout: "__COMMIT__\nabc123\nfeat: sample\nM\tsrc/billing/invoice.ts\n",
      stderr: "",
    }));
    Object.assign(execFileMock, {
      [Symbol.for("nodejs.util.promisify.custom")]: execFilePromiseMock,
    });
    vi.doMock("node:child_process", () => ({
      execFile: execFileMock,
    }));

    const { normalizeHistory } = await import("../src/core/history.js");
    const policyConfig: PolicyConfig = {
      profiles: {
        default: {
          domains: {},
        },
      },
    };

    const commits = await normalizeHistory("/tmp/repo", policyConfig, "default");

    expect(commits).toHaveLength(1);
    expect(execFilePromiseMock).toHaveBeenCalledWith(
      "git",
      [
        "-C",
        "/tmp/repo",
        "log",
        "--no-merges",
        "--find-renames",
        "--name-status",
        "--pretty=format:__COMMIT__%n%H%n%s",
      ],
      expect.objectContaining({
        cwd: "/tmp/repo",
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  });
});
