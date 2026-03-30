import type { ProgressUpdate } from "./common.js";

export interface DomainPack {
  id: string;
  version: string;
  commands: string[];
  metrics: string[];
  reviewRules: string[];
}

export interface CommandContext {
  cwd: string;
  reportProgress?: (update: ProgressUpdate) => void;
}
