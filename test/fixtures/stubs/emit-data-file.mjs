import { readFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("input path is required");
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), inputPath);
const content = await readFile(resolvedPath, "utf8");
const data = resolvedPath.endsWith(".yaml") || resolvedPath.endsWith(".yml")
  ? YAML.parse(content)
  : JSON.parse(content);

process.stdout.write(JSON.stringify(data));
