import type { CommandArgs } from "./command-helpers.js";
import type { CommandContext, CommandResponse } from "./core/contracts.js";

export type CommandHandler = (args: CommandArgs, context: CommandContext) => Promise<CommandResponse<unknown>>;
export type CommandLookup = (name: string) => CommandHandler | undefined;
