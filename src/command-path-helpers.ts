import path from "node:path";

import type { CommandContext } from "./core/contracts.js";

export type CommandArgs = Record<string, string | boolean>;

export function resolveSpecRelativePath(baseDirectory: string, input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(baseDirectory, input);
}

export function parseTieTolerance(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

export function getRootPath(args: CommandArgs, context: CommandContext): string {
  return typeof args.repo === "string" ? new URL(args.repo, `file://${context.cwd}/`).pathname : context.cwd;
}

export function getDocsRoot(args: CommandArgs, context: CommandContext): string {
  return typeof args["docs-root"] === "string"
    ? new URL(args["docs-root"], `file://${context.cwd}/`).pathname
    : context.cwd;
}

export function getProfile(args: CommandArgs): string {
  return typeof args.profile === "string" ? args.profile : "default";
}
