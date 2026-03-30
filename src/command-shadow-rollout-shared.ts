import type { CommandHandler, CommandLookup } from "./command-types.js";

export function requireRegisteredCommand(commandLookup: CommandLookup, name: string): CommandHandler {
  const command = commandLookup(name);
  if (!command) {
    throw new Error(`${name} is not registered`);
  }
  return command;
}

export function parseSafeTieTolerance(rawValue: string | undefined): number {
  const tieTolerance = typeof rawValue === "string" ? Number.parseFloat(rawValue) : 0.02;
  return Number.isFinite(tieTolerance) && tieTolerance >= 0 ? tieTolerance : 0.02;
}

export function resolveTieTolerance(...rawValues: Array<string | number | undefined>): number {
  for (const rawValue of rawValues) {
    if (rawValue === undefined) {
      continue;
    }
    const tieTolerance = typeof rawValue === "number" ? rawValue : Number.parseFloat(rawValue);
    if (Number.isFinite(tieTolerance) && tieTolerance >= 0) {
      return tieTolerance;
    }
  }
  return 0.02;
}
