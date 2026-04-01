import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { readDataFile } from "../src/core/io.js";
import { cleanupTemporaryRepo, createTemporaryWorkspace } from "./helpers.js";

const POLICY_PATH = path.resolve("fixtures/policies/default.yaml");
const GOLDEN_CORPUS_ENTRY_ROOT = path.join("fixtures", "validation", "golden-corpus");

type BundleName = "good" | "thin-evidence" | "misleading";

interface BundleManifest {
  version: string;
  repo: string;
  constraints: string;
  args?: Record<string, string>;
}

type ScoreResponse = Awaited<ReturnType<NonNullable<(typeof COMMANDS)["score.compute"]>>>;

interface BundleRun {
  name: BundleName;
  score: ScoreResponse;
  report: string;
  reviewItems: Array<{ reason: string; summary: string; confidence: number }>;
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

function getProxySectionLines(report: string): string[] {
  const match = report.match(/## Proxy \/ Partial Signals\n([\s\S]*?)(?:\n## |\n$)/);
  const section = match?.[1];
  if (!section) {
    return [];
  }
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function collectProxyClasses(reviewItems: Array<{ summary: string }>): string[] {
  const classes = new Set<string>();
  for (const item of reviewItems) {
    if (/static proxy/i.test(item.summary)) {
      classes.add("static_proxy");
      continue;
    }
    if (/partial approximation/i.test(item.summary) || /partial proxy/i.test(item.summary)) {
      classes.add("partial");
      continue;
    }
    if (/bridge/i.test(item.summary)) {
      classes.add("bridge");
      continue;
    }
    if (/proxy/i.test(item.summary)) {
      classes.add("proxy");
    }
  }
  return Array.from(classes).sort();
}

async function loadBundle(name: BundleName): Promise<BundleRun> {
  const bundleEntry = path.join(GOLDEN_CORPUS_ENTRY_ROOT, name);
  const tempRoot = await createTemporaryWorkspace([bundleEntry]);
  tempRoots.push(tempRoot);
  const bundleRoot = path.join(tempRoot, bundleEntry);
  const manifest = await readDataFile<BundleManifest>(path.join(bundleRoot, "bundle.yaml"));
  const args = {
    domain: "architecture_design",
    policy: POLICY_PATH,
    repo: path.join(bundleRoot, manifest.repo),
    constraints: path.join(bundleRoot, manifest.constraints),
    ...Object.fromEntries(
      Object.entries(manifest.args ?? {}).map(([key, value]) => [key, path.join(bundleRoot, value)]),
    ),
  };

  const score = await COMMANDS["score.compute"]!(args, { cwd: process.cwd() });
  const report = await COMMANDS["report.generate"]!({ ...args, format: "md" }, { cwd: process.cwd() });
  const review = await COMMANDS["review.list_unknowns"]!(args, { cwd: process.cwd() });

  return {
    name,
    score,
    report: (report.result as { report: string }).report,
    reviewItems: (review.result as { reviewItems: Array<{ reason: string; summary: string; confidence: number }> })
      .reviewItems,
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

describe("golden corpus architecture bundles", () => {
  test("preserve metric ordering, confidence floors, and measurement-quality ranges", async () => {
    const bundles = await getBundleRuns();
    const good = bundles.good;
    const thin = bundles["thin-evidence"];
    const misleading = bundles.misleading;

    for (const bundle of [good, thin, misleading]) {
      expect(bundle.score.status).not.toBe("error");
      expect(bundle.score.confidence).toBeGreaterThan(0.7);
    }

    expect(getMetric(good.score, "APSI").value).toBeGreaterThan(getMetric(thin.score, "APSI").value);
    expect(getMetric(thin.score, "APSI").value).toBeGreaterThan(getMetric(misleading.score, "APSI").value);

    expect(getMetric(good.score, "QSF").value).toBeGreaterThan(getMetric(thin.score, "QSF").value);
    expect(getMetric(thin.score, "QSF").value).toBeGreaterThan(getMetric(misleading.score, "QSF").value);

    expect(getMetric(good.score, "TIS").value).toBeGreaterThan(getMetric(thin.score, "TIS").value);
    expect(getMetric(good.score, "TIS").value).toBeGreaterThan(getMetric(misleading.score, "TIS").value);
    expect(getMetric(thin.score, "TIS").value).toBeLessThan(0.65);
    expect(getMetric(misleading.score, "TIS").value).toBeLessThan(0.65);

    expect(getMetric(good.score, "OAS").value).toBeGreaterThan(getMetric(thin.score, "OAS").value);
    expect(getMetric(thin.score, "OAS").value).toBeGreaterThan(getMetric(misleading.score, "OAS").value);

    expect(getMetric(good.score, "EES").value).toBeGreaterThan(getMetric(thin.score, "EES").value);
    expect(getMetric(thin.score, "EES").value).toBeGreaterThan(getMetric(misleading.score, "EES").value);

    const goodQuality = good.score.meta?.measurementQuality;
    const thinQuality = thin.score.meta?.measurementQuality;
    const misleadingQuality = misleading.score.meta?.measurementQuality;

    expect(goodQuality).toBeDefined();
    expect(thinQuality).toBeDefined();
    expect(misleadingQuality).toBeDefined();

    expect(goodQuality?.unknownsCount ?? 0).toBeLessThan(misleadingQuality?.unknownsCount ?? 0);
    expect(misleadingQuality?.unknownsCount ?? 0).toBeLessThan(thinQuality?.unknownsCount ?? 0);

    expect(goodQuality?.proxyRate ?? 0).toBeLessThan(misleadingQuality?.proxyRate ?? 1);
    expect(misleadingQuality?.proxyRate ?? 0).toBeLessThan(thinQuality?.proxyRate ?? 1);

    expect(goodQuality?.proxyMetrics ?? []).toHaveLength(3);
    expect(thinQuality?.proxyMetrics ?? []).toHaveLength(5);
    expect(misleadingQuality?.proxyMetrics ?? []).toHaveLength(4);
  });

  test("surfaces proxy-heavy unknown classes through report and review", async () => {
    const bundles = await getBundleRuns();
    const good = bundles.good;
    const thin = bundles["thin-evidence"];
    const misleading = bundles.misleading;

    const goodProxyLines = getProxySectionLines(good.report);
    const thinProxyLines = getProxySectionLines(thin.report);
    const misleadingProxyLines = getProxySectionLines(misleading.report);

    expect(goodProxyLines.length).toBeGreaterThan(0);
    expect(thinProxyLines.length).toBeGreaterThan(goodProxyLines.length);
    expect(misleadingProxyLines.length).toBeGreaterThan(goodProxyLines.length);
    expect(goodProxyLines).toEqual(expect.arrayContaining([expect.stringContaining("APSI: PCS is a proxy composite")]));
    expect(goodProxyLines.some((line) => line.includes("AELS:"))).toBe(true);
    expect(goodProxyLines.some((line) => line.includes("EES:"))).toBe(true);

    expect(collectProxyClasses(good.reviewItems)).toEqual(["proxy"]);
    expect(collectProxyClasses(thin.reviewItems)).toEqual(
      expect.arrayContaining(["bridge", "partial", "proxy", "static_proxy"]),
    );
    expect(collectProxyClasses(misleading.reviewItems)).toEqual(expect.arrayContaining(["bridge", "proxy"]));

    for (const bundle of [good, thin, misleading]) {
      const reasons = new Set(bundle.reviewItems.map((item) => item.reason));
      expect([...reasons]).toContain("unknown");
      expect([...reasons]).toContain("low_confidence");
    }
  });
});
