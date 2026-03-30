import type { ExtractionKind, ExtractionProviderName, Fragment } from "./contracts.js";

export interface CliExtractionOptions {
  cwd: string;
  provider: ExtractionProviderName;
  providerCommand?: string;
  kind: ExtractionKind;
  promptProfile: string;
  fragments: Fragment[];
}

export type RawProviderItem = Record<string, unknown>;
