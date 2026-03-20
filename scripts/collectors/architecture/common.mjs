#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

export async function readStructuredInput(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  const raw = await readFile(resolvedPath, "utf8");
  const extension = path.extname(resolvedPath).toLowerCase();

  if (extension === ".yaml" || extension === ".yml") {
    return YAML.parse(raw);
  }
  if (extension === ".json") {
    return JSON.parse(raw);
  }

  throw new Error(`unsupported input extension: ${extension}`);
}

export function requireInputPath(argv) {
  const inputPath = argv[2];
  if (!inputPath) {
    throw new Error("input file path is required");
  }
  return inputPath;
}

export function writeCanonicalJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function pickDefinedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}
