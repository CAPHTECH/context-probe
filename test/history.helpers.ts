import type { CochangeCommit, DomainModel } from "../src/core/contracts.js";

export const MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] },
  ],
};

export function commit(hash: string, files: string[]): CochangeCommit {
  return {
    hash,
    subject: hash,
    files,
  };
}
