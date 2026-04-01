import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CommandResponse } from "./contracts.js";

export interface CommandEventLogEntry {
  timestamp: string;
  sessionId: string;
  command: string;
  domain?: string;
  status: string;
  durationMs: number;
  confidence: number;
  unknownsCount: number;
  proxyRate: number;
  repoBasename?: string;
  repoPathHash?: string;
}

export interface CommandEventLogSummary {
  entries: number;
  commandMix: Record<string, number>;
  averageDurationByCommandDomain: Record<string, number>;
  averageProxyRate: number;
  averageUnknownsCount: number;
  followUpRate: number;
}

function normalizeEventLogPath(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.CONTEXT_PROBE_EVENT_LOG;
  return value && path.isAbsolute(value) ? value : undefined;
}

function hashPath(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function resolveCommandSessionId(env: NodeJS.ProcessEnv): string {
  return env.CONTEXT_PROBE_SESSION_ID || randomUUID();
}

export async function appendCommandEventLog(input: {
  env: NodeJS.ProcessEnv;
  command: string;
  repoPath?: string;
  durationMs: number;
  response: CommandResponse<unknown>;
  sessionId: string;
}): Promise<void> {
  const logPath = normalizeEventLogPath(input.env);
  if (!logPath) {
    return;
  }
  const measurementQuality = input.response.meta?.measurementQuality;
  const entry: CommandEventLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId,
    command: input.command,
    ...(typeof input.response.result === "object" &&
    input.response.result !== null &&
    "domainId" in input.response.result
      ? { domain: (input.response.result as { domainId?: string }).domainId }
      : {}),
    status: input.response.status,
    durationMs: input.durationMs,
    confidence: input.response.confidence,
    unknownsCount: measurementQuality?.unknownsCount ?? input.response.unknowns.length,
    proxyRate: measurementQuality?.proxyRate ?? 0,
    ...(input.repoPath ? { repoBasename: path.basename(input.repoPath), repoPathHash: hashPath(input.repoPath) } : {}),
  };
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function summarizeCommandEventEntries(entries: CommandEventLogEntry[]): CommandEventLogSummary {
  const commandCounts = new Map<string, number>();
  const domainDurations = new Map<string, number[]>();
  let proxyRateTotal = 0;
  let unknownsCountTotal = 0;
  const sessions = new Map<string, CommandEventLogEntry[]>();

  for (const entry of entries) {
    commandCounts.set(entry.command, (commandCounts.get(entry.command) ?? 0) + 1);
    const durationKey = `${entry.command}:${entry.domain ?? "none"}`;
    const durations = domainDurations.get(durationKey) ?? [];
    durations.push(entry.durationMs);
    domainDurations.set(durationKey, durations);
    proxyRateTotal += entry.proxyRate;
    unknownsCountTotal += entry.unknownsCount;
    const sessionEntries = sessions.get(entry.sessionId) ?? [];
    sessionEntries.push(entry);
    sessions.set(entry.sessionId, sessionEntries);
  }

  const followUpSessions = Array.from(sessions.values()).filter((sessionEntries) => {
    const commands = new Set(sessionEntries.map((entry) => entry.command));
    return commands.has("report.generate") || commands.has("review.list_unknowns");
  }).length;

  return {
    entries: entries.length,
    commandMix: Object.fromEntries(
      Array.from(commandCounts.entries()).sort(([left], [right]) => left.localeCompare(right)),
    ),
    averageDurationByCommandDomain: Object.fromEntries(
      Array.from(domainDurations.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, durations]) => [key, durations.reduce((sum, value) => sum + value, 0) / durations.length]),
    ),
    averageProxyRate: entries.length === 0 ? 0 : proxyRateTotal / entries.length,
    averageUnknownsCount: entries.length === 0 ? 0 : unknownsCountTotal / entries.length,
    followUpRate: sessions.size === 0 ? 0 : followUpSessions / sessions.size,
  };
}

export async function readAndSummarizeCommandEventLog(inputPath: string): Promise<CommandEventLogSummary> {
  const raw = await fs.readFile(path.resolve(inputPath), "utf8");
  const entries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CommandEventLogEntry);
  return summarizeCommandEventEntries(entries);
}
