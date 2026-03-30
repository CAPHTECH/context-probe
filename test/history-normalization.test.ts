import { EventEmitter } from "node:events";

import { afterEach, describe, expect, test, vi } from "vitest";

import type { PolicyConfig } from "../src/core/contracts.js";

const POLICY: PolicyConfig = {
  profiles: {
    default: {
      domains: {},
    },
  },
};

describe("history normalization", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("node:child_process");
  });

  test("streams git history output without relying on execFile maxBuffer", async () => {
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
        child.stdout.emit("data", "__COM");
        child.stdout.emit(
          "data",
          "MIT__\nabc123\nfeat: sample commit\nM\tsrc/billing/invoice.ts\n__COMMIT__\ndef456\n",
        );
        child.stdout.emit("data", "feat: rename sample\nR100\tsrc/old.ts\tsrc/new.ts\n__COMMIT__\nghi789\n");
        child.stdout.emit("data", "feat: copy sample\nC100\tsrc/original.ts\tsrc/copied.ts\n");
        child.emit("close", 0, null);
      });
      return child;
    });

    vi.doMock("node:child_process", () => ({
      spawn: spawnMock,
    }));

    const { normalizeHistory } = await import("../src/core/history.js");
    const commits = await normalizeHistory("/tmp/example-repo", POLICY, "default");

    expect(commits).toHaveLength(3);
    expect(commits[0]?.files).toEqual(["src/billing/invoice.ts"]);
    expect(commits[1]?.files).toEqual(["src/new.ts"]);
    expect(commits[2]?.files).toEqual(["src/copied.ts"]);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(
      "git",
      [
        "-C",
        "/tmp/example-repo",
        "log",
        "--no-merges",
        "--find-renames",
        "--name-status",
        "--pretty=format:__COMMIT__%n%H%n%s",
      ],
      expect.objectContaining({
        cwd: "/tmp/example-repo",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });
});
