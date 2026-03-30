import { EventEmitter } from "node:events";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { PolicyConfig } from "../src/core/contracts.js";

describe("history buffer configuration", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:child_process");
  });

  test("normalizeHistory streams git log output without execFile buffering limits", async () => {
    const spawnMock = vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter & { setEncoding: (encoding: string) => void };
        stderr: EventEmitter & { setEncoding: (encoding: string) => void };
      };
      child.stdout = new EventEmitter() as EventEmitter & { setEncoding: (encoding: string) => void };
      child.stderr = new EventEmitter() as EventEmitter & { setEncoding: (encoding: string) => void };
      child.stdout.setEncoding = vi.fn();
      child.stderr.setEncoding = vi.fn();
      queueMicrotask(() => {
        child.stdout.emit(
          "data",
          Array.from(
            { length: 32 },
            (_, index) => `__COMMIT__\ncommit-${index}\nfeat: sample ${index}\nM\tsrc/sample-${index}.ts\n`,
          ).join(""),
        );
        child.emit("close", 0, null);
      });
      return child;
    });

    vi.doMock("node:child_process", () => ({
      spawn: spawnMock,
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

    expect(commits).toHaveLength(32);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
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
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });
});
