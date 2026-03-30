import path from "node:path";

import { expect, test } from "vitest";

import { parseCodebase } from "../src/analyzers/code.js";
import { registerArtifacts } from "../src/core/artifacts.js";
import { buildTermTraceLinks } from "../src/core/trace.js";

import { createFlutterTraceTerms, PARSER_REPO } from "./dart-support.helpers.js";

export function registerDartSupportTraceTests(): void {
  test("treats Dart files as source artifacts and excludes generated Dart files from trace hits", async () => {
    const artifacts = await registerArtifacts(PARSER_REPO);
    const { scorableSourceFiles } = await parseCodebase(PARSER_REPO);
    const terms = createFlutterTraceTerms();

    expect(artifacts.find((artifact) => artifact.path === "lib/contracts/order_contract.dart")?.type).toBe(
      "source_code",
    );

    const links = await buildTermTraceLinks({
      docsRoot: path.join(PARSER_REPO, "docs"),
      repoRoot: PARSER_REPO,
      codeFiles: scorableSourceFiles,
      terms,
    });

    expect(links.find((link) => link.canonicalTerm === "OrderContract")?.coverage.codeHits).toBeGreaterThan(0);
    expect(links.find((link) => link.canonicalTerm === "GeneratedOnly")?.coverage.codeHits).toBe(0);
  });

  test("emits trace-link progress updates while scanning terms", async () => {
    const { scorableSourceFiles } = await parseCodebase(PARSER_REPO);
    const progress: string[] = [];

    await buildTermTraceLinks({
      docsRoot: path.join(PARSER_REPO, "docs"),
      repoRoot: PARSER_REPO,
      codeFiles: scorableSourceFiles,
      terms: createFlutterTraceTerms(),
      progressIntervalMs: 0,
      onProgress: (update) => {
        progress.push(`${update.phase}:${update.message}`);
      },
    });

    expect(progress.some((entry) => entry.startsWith("start:Preparing trace links"))).toBe(true);
    expect(progress.some((entry) => entry.startsWith("heartbeat:Trace linking is still running"))).toBe(true);
    expect(progress.some((entry) => entry.startsWith("complete:Trace linking completed"))).toBe(true);
  });
}
