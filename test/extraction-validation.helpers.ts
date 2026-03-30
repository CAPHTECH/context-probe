import { existsSync } from "node:fs";
import { access, chmod, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ValidationCase, ValidationExpectation } from "./extraction-validation.types.js";

const VALIDATION_ROOT = path.resolve("fixtures/validation/extraction");
const PROVIDER_STUBS = {
  codex: path.resolve("test/fixtures/stubs/codex-stub.mjs"),
  claude: path.resolve("test/fixtures/stubs/claude-stub.mjs"),
} as const;

export async function loadValidationCases(): Promise<ValidationCase[]> {
  const entries = await readdir(VALIDATION_ROOT, { withFileTypes: true });
  const cases = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const casePath = path.join(VALIDATION_ROOT, entry.name);
        const expectation = JSON.parse(
          await readFile(path.join(casePath, "expectations.json"), "utf8"),
        ) as ValidationExpectation;
        return {
          name: entry.name,
          path: casePath,
          expectation,
        };
      }),
  );
  return cases.sort((left, right) => left.name.localeCompare(right.name));
}

export function buildBaseArgs(casePath: string, expectation: ValidationExpectation): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {
    "docs-root": casePath,
    extractor: expectation.extractor.backend,
  };
  const repoPath = path.join(casePath, "repo");
  if (expectation.trace || hasRepoDirectory(casePath)) {
    args.repo = repoPath;
  }
  if (expectation.extractor.backend === "cli" && expectation.extractor.provider) {
    args.provider = expectation.extractor.provider;
    args["provider-cmd"] = PROVIDER_STUBS[expectation.extractor.provider];
    args.fallback = "none";
  }
  return args;
}

export async function ensureProviderStubsExecutable() {
  await Promise.all(Object.values(PROVIDER_STUBS).map(async (stub) => chmod(stub, 0o755)));
}

export async function verifyProviderStubsReadable() {
  await Promise.all(Object.values(PROVIDER_STUBS).map(async (stub) => access(stub)));
}

function hasRepoDirectory(casePath: string): boolean {
  return existsSync(path.join(casePath, "repo"));
}
