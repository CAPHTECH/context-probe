#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import {
  ARCHITECTURE_CURATED_SNAPSHOT_PATHS,
  ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS,
  mapLayerNameToBoundaryName,
} from "./architecture-bundle.mjs";

export function parseRepoRootAndNowArgs(argv, defaultRepoRoot) {
  const args = {
    repoRoot: defaultRepoRoot,
    now: new Date().toISOString(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo-root") {
      args.repoRoot = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (token === "--now") {
      args.now = argv[index + 1] ?? "";
      index += 1;
    }
  }

  if (!args.repoRoot) {
    throw new Error("--repo-root requires a value");
  }
  if (!isValidIsoTimestamp(args.now)) {
    throw new Error(`--now must be a valid ISO-8601 timestamp: ${args.now}`);
  }

  return args;
}

export function isValidIsoTimestamp(value) {
  if (!value) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

export function normalizeRelativePath(repoRoot, absolutePath) {
  const relativePath = path.relative(repoRoot, absolutePath);
  return relativePath.split(path.sep).join("/");
}

export function formatSourceDate(isoTimestamp) {
  return isoTimestamp.slice(0, 10);
}

export async function readStructuredFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    return JSON.parse(raw);
  }
  if (extension === ".yaml" || extension === ".yml") {
    return YAML.parse(raw);
  }
  throw new Error(`unsupported structured file extension: ${extension}`);
}

export async function writeCanonicalJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeCanonicalYaml(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, YAML.stringify(value, null, { lineWidth: 0 }), "utf8");
}

export async function sha256File(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function isOlderThanThreshold(isoTimestamp, nowIsoTimestamp, days) {
  const capturedAt = Date.parse(isoTimestamp);
  const now = Date.parse(nowIsoTimestamp);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(now)) {
    return false;
  }
  return now - capturedAt > days * 24 * 60 * 60 * 1000;
}

function relativePathToKey(relativePath) {
  const fileName = path.basename(relativePath);
  switch (fileName) {
    case "architecture-scenarios.yaml":
      return "scenarios";
    case "architecture-topology.yaml":
      return "topology";
    case "architecture-runtime-observations.yaml":
      return "runtimeObservations";
    case "architecture-telemetry-observations.yaml":
      return "telemetryObservations";
    case "architecture-pattern-runtime-observations.yaml":
      return "patternRuntimeObservations";
    case "architecture-delivery-observations.yaml":
      return "deliveryObservations";
    default:
      throw new Error(`unmapped self-measurement path: ${relativePath}`);
  }
}

export async function collectCuratedSnapshotWarnings({ nowIsoTimestamp, paths }) {
  const warnings = [];

  for (const relativePath of ARCHITECTURE_CURATED_SNAPSHOT_PATHS) {
    const absolutePath = paths[relativePathToKey(relativePath)];
    if (!existsSync(absolutePath)) {
      warnings.push(`Curated snapshot ${relativePath} is missing.`);
      continue;
    }

    const document = await readStructuredFile(absolutePath);
    const reviewedAt = document?.snapshot?.reviewedAt;
    if (!isValidIsoTimestamp(reviewedAt)) {
      warnings.push(`Curated snapshot ${relativePath} is missing snapshot.reviewedAt.`);
      continue;
    }
    if (isOlderThanThreshold(reviewedAt, nowIsoTimestamp, ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS.curatedDays)) {
      warnings.push(
        `Curated snapshot ${relativePath} was last reviewed at ${reviewedAt} and is older than ${ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS.curatedDays} days.`,
      );
    }
  }

  return warnings;
}

export async function collectMeasuredSnapshotWarnings({ repoRoot, nowIsoTimestamp, paths }) {
  const warnings = [];
  const relativePath = normalizeRelativePath(repoRoot, paths.scenarioObservations);
  if (!existsSync(paths.scenarioObservations)) {
    warnings.push(`Measured snapshot ${relativePath} is missing.`);
    return warnings;
  }

  const document = await readStructuredFile(paths.scenarioObservations);
  const capturedAt = document?.snapshot?.capturedAt;
  if (!isValidIsoTimestamp(capturedAt)) {
    warnings.push(`Measured snapshot ${relativePath} is missing snapshot.capturedAt.`);
    return warnings;
  }
  if (isOlderThanThreshold(capturedAt, nowIsoTimestamp, ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS.measuredDays)) {
    warnings.push(
      `Measured snapshot ${relativePath} was captured at ${capturedAt} and is older than ${ARCHITECTURE_SELF_MEASUREMENT_FRESHNESS.measuredDays} days.`,
    );
  }
  return warnings;
}

export async function collectDerivedBoundaryWarnings({ repoRoot, paths, constraintsHash }) {
  const warnings = [];
  const relativePath = normalizeRelativePath(repoRoot, paths.boundaryMap);
  if (!existsSync(paths.boundaryMap)) {
    warnings.push(`Derived boundary map ${relativePath} is missing.`);
    return warnings;
  }

  const document = await readStructuredFile(paths.boundaryMap);
  const derivedFrom = document?.snapshot?.derivedFrom;
  const expectedPath = normalizeRelativePath(repoRoot, paths.constraints);

  if (!derivedFrom?.sha256) {
    warnings.push(`Derived boundary map ${relativePath} is missing snapshot.derivedFrom.sha256.`);
  } else if (derivedFrom.sha256 !== constraintsHash) {
    warnings.push(`Derived boundary map ${relativePath} was generated from a different constraints hash.`);
  }

  if (!derivedFrom?.path) {
    warnings.push(`Derived boundary map ${relativePath} is missing snapshot.derivedFrom.path.`);
  } else if (derivedFrom.path !== expectedPath) {
    warnings.push(`Derived boundary map ${relativePath} points to ${derivedFrom.path} instead of ${expectedPath}.`);
  }

  return warnings;
}

export async function collectContractBaselineWarnings({ repoRoot, paths }) {
  const warnings = [];
  const relativePath = normalizeRelativePath(repoRoot, paths.contractBaseline);
  if (!existsSync(paths.contractBaseline)) {
    warnings.push(`Contract baseline ${relativePath} is missing.`);
    return warnings;
  }

  try {
    const document = await readStructuredFile(paths.contractBaseline);
    if (!Array.isArray(document?.contracts)) {
      warnings.push(`Contract baseline ${relativePath} does not contain a contracts array.`);
    }
  } catch (error) {
    warnings.push(
      `Contract baseline ${relativePath} could not be read: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }

  return warnings;
}

export async function collectArchitectureSelfMeasurementWarnings({ repoRoot, nowIsoTimestamp, paths, constraintsHash }) {
  return [
    ...(await collectMeasuredSnapshotWarnings({ repoRoot, nowIsoTimestamp, paths })),
    ...(await collectCuratedSnapshotWarnings({ nowIsoTimestamp, paths })),
    ...(await collectDerivedBoundaryWarnings({ repoRoot, paths, constraintsHash })),
    ...(await collectContractBaselineWarnings({ repoRoot, paths })),
  ];
}

export async function deriveBoundaryMap({ nowIsoTimestamp, repoRoot, paths, constraintsHash }) {
  const constraints = await readStructuredFile(paths.constraints);
  return {
    version: constraints.version ?? "1.0",
    snapshot: {
      sourceKind: "derived",
      capturedAt: nowIsoTimestamp,
      derivedFrom: {
        path: normalizeRelativePath(repoRoot, paths.constraints),
        sha256: constraintsHash,
      },
    },
    boundaries: Array.isArray(constraints.layers)
      ? constraints.layers.map((layer) => ({
          name: mapLayerNameToBoundaryName(layer.name),
          pathGlobs: Array.isArray(layer.globs) ? [...layer.globs] : [],
        }))
      : [],
  };
}
