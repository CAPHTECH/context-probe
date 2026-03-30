import type { DomainModel } from "../src/core/contracts.js";

export const SYNTHETIC_MODEL: DomainModel = {
  version: "1.0",
  contexts: [
    { name: "billing", pathGlobs: ["src/billing/**"] },
    { name: "fulfillment", pathGlobs: ["src/fulfillment/**"] },
    { name: "support", pathGlobs: ["src/support/**"] },
  ],
};
