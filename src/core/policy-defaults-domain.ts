import type { DomainPolicy } from "./contracts.js";

export function createDomainDesignPolicy(): DomainPolicy {
  return {
    metrics: {
      DRF: {
        formula: "0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA",
        thresholds: {
          warn: 0.7,
          fail: 0.55,
        },
      },
      ULI: {
        formula: "0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL",
        thresholds: {
          warn: 0.7,
          fail: 0.55,
        },
      },
      BFS: {
        formula: "0.50*A + 0.50*R",
        thresholds: {
          warn: 0.7,
          fail: 0.55,
        },
      },
      AFS: {
        formula: "0.60*SIC + 0.40*(1-XTC)",
        thresholds: {
          warn: 0.7,
          fail: 0.55,
        },
      },
      MCCS: {
        formula: "0.50*MRP + 0.25*(1-BLR) + 0.25*CLA",
        thresholds: {
          warn: 0.7,
          fail: 0.55,
        },
      },
      ELS: {
        formula: "0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)",
        thresholds: {
          warn: 0.68,
          fail: 0.5,
        },
      },
    },
    review: {
      require_human_if: ["confidence < 0.75", "unknowns_count > 0"],
    },
  };
}
