import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { readDataFile } from "../src/core/io.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace, initializeTemporaryGitRepo } from "./helpers.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const GOLDEN_CORPUS_ENTRY_ROOT = path.join("fixtures", "validation", "golden-corpus-domain");

type BundleName = "good" | "thin-evidence" | "misleading";

interface BundleManifest {
  version: string;
  repo: string;
  model: string;
  docsRoot: string;
}

type ScoreResponse = Awaited<ReturnType<NonNullable<(typeof COMMANDS)["score.compute"]>>>;

interface BundleRun {
  name: BundleName;
  score: ScoreResponse;
  report: string;
  reviewItems: Array<{ reason: string; kind?: string; summary: string; confidence: number }>;
}

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((repoPath) => cleanupTemporaryRepo(repoPath)));
});

function getMetric(response: ScoreResponse, metricId: string) {
  const result = response.result as {
    metrics: Array<{
      metricId: string;
      value: number;
      confidence: number;
      unknowns: string[];
    }>;
  };
  const metric = result.metrics.find((entry) => entry.metricId === metricId);
  if (!metric) {
    throw new Error(`Metric not found: ${metricId}`);
  }
  return metric;
}

async function loadBundle(name: BundleName): Promise<BundleRun> {
  const bundleEntry = path.join(GOLDEN_CORPUS_ENTRY_ROOT, name);
  const tempRoot = await createTemporaryWorkspace([bundleEntry]);
  tempRoots.push(tempRoot);
  const bundleRoot = path.join(tempRoot, bundleEntry);
  const manifest = await readDataFile<BundleManifest>(path.join(bundleRoot, "bundle.yaml"));
  const repoPath = path.join(bundleRoot, manifest.repo);
  await initializeTemporaryGitRepo(repoPath, `feat: initialize ${name} domain golden corpus`);

  const args = {
    domain: "domain_design",
    policy: POLICY_PATH,
    repo: repoPath,
    model: path.join(bundleRoot, manifest.model),
    "docs-root": path.join(bundleRoot, manifest.docsRoot),
  };

  const score = await COMMANDS["score.compute"]!(args, { cwd: process.cwd() });
  const report = await COMMANDS["report.generate"]!({ ...args, format: "md" }, { cwd: process.cwd() });
  const review = await COMMANDS["review.list_unknowns"]!(args, { cwd: process.cwd() });

  return {
    name,
    score,
    report: (report.result as { report: string }).report,
    reviewItems: (
      review.result as {
        reviewItems: Array<{ reason: string; kind?: string; summary: string; confidence: number }>;
      }
    ).reviewItems,
  };
}

let bundleRunsPromise: Promise<Record<BundleName, BundleRun>> | undefined;

async function getBundleRuns(): Promise<Record<BundleName, BundleRun>> {
  bundleRunsPromise ??= Promise.all([loadBundle("good"), loadBundle("thin-evidence"), loadBundle("misleading")]).then(
    ([good, thinEvidence, misleading]) => ({
      good,
      "thin-evidence": thinEvidence,
      misleading,
    }),
  );

  return bundleRunsPromise;
}

function collectKinds(reviewItems: Array<{ kind?: string }>): string[] {
  return Array.from(
    new Set(reviewItems.map((item) => item.kind).filter((kind): kind is string => Boolean(kind))),
  ).sort();
}

describe("golden corpus domain bundles", () => {
  test("preserve domain metric ordering and measurement-quality ranges", async () => {
    const bundles = await getBundleRuns();
    const good = bundles.good;
    const thin = bundles["thin-evidence"];
    const misleading = bundles.misleading;

    for (const bundle of [good, thin, misleading]) {
      expect(bundle.score.status).not.toBe("error");
      expect(bundle.score.confidence).toBeGreaterThan(0.6);
      expect(bundle.score.meta?.measurementQuality).toBeDefined();
    }

    expect(getMetric(good.score, "DRF").value).toBeGreaterThan(getMetric(thin.score, "DRF").value);

    expect(getMetric(good.score, "ULI").value).toBeGreaterThan(getMetric(thin.score, "ULI").value);
    expect(getMetric(good.score, "ULI").value).toBeGreaterThan(getMetric(misleading.score, "ULI").value);

    expect(getMetric(good.score, "AFS").value).toBeGreaterThan(getMetric(thin.score, "AFS").value);
    expect(getMetric(good.score, "AFS").value).toBeGreaterThan(getMetric(misleading.score, "AFS").value);

    const goodQuality = good.score.meta?.measurementQuality;
    const thinQuality = thin.score.meta?.measurementQuality;
    const misleadingQuality = misleading.score.meta?.measurementQuality;

    expect(goodQuality?.unknownsCount ?? 0).toBeLessThan(thinQuality?.unknownsCount ?? 0);
    expect(goodQuality?.unknownsCount ?? 0).toBeLessThan(misleadingQuality?.unknownsCount ?? 0);
    expect(goodQuality?.proxyRate ?? 1).toBeLessThanOrEqual(thinQuality?.proxyRate ?? 1);
    expect(goodQuality?.proxyRate ?? 1).toBeLessThanOrEqual(misleadingQuality?.proxyRate ?? 1);
    expect(getMetric(misleading.score, "AFS").value).toBeLessThan(0.5);
  });

  test("render actionable sections and classify thin or misleading evidence in review output", async () => {
    const bundles = await getBundleRuns();

    for (const bundle of Object.values(bundles)) {
      expect(bundle.report).toContain("## Measurement Quality");
      expect(bundle.report).toContain("## Suggested Next Evidence");
      expect(bundle.report).toContain("## Action Queue");
    }

    expect(collectKinds(bundles.good.reviewItems)).toEqual(expect.arrayContaining(["proxy"]));
    expect(collectKinds(bundles["thin-evidence"].reviewItems)).toEqual(
      expect.arrayContaining(["missing_input", "proxy"]),
    );
    expect(collectKinds(bundles.misleading.reviewItems)).toEqual(expect.arrayContaining(["proxy"]));
  });
});
