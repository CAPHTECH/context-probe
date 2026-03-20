import type { DomainPolicy, PolicyConfig } from "./contracts.js";
import { readDataFile } from "./io.js";

export const DEFAULT_POLICY: PolicyConfig = {
  profiles: {
    default: {
      domains: {
        domain_design: {
          metrics: {
            DRF: {
              formula: "0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA",
              thresholds: {
                warn: 0.7,
                fail: 0.55
              }
            },
            ULI: {
              formula: "0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL",
              thresholds: {
                warn: 0.7,
                fail: 0.55
              }
            },
            BFS: {
              formula: "0.50*A + 0.50*R",
              thresholds: {
                warn: 0.7,
                fail: 0.55
              }
            },
            AFS: {
              formula: "0.60*SIC + 0.40*(1-XTC)",
              thresholds: {
                warn: 0.7,
                fail: 0.55
              }
            },
            MCCS: {
              formula: "0.50*MRP + 0.25*(1-BLR) + 0.25*CLA",
              thresholds: {
                warn: 0.7,
                fail: 0.55
              }
            },
            ELS: {
              formula: "0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)",
              thresholds: {
                warn: 0.68,
                fail: 0.5
              }
            }
          },
          review: {
            require_human_if: ["confidence < 0.75", "unknowns_count > 0"]
          }
        },
        architecture_design: {
          metrics: {
            DDS: {
              formula: "0.60*(1-IDR) + 0.25*LRC + 0.15*APM",
              thresholds: {
                warn: 0.72,
                fail: 0.58
              }
            },
            BPS: {
              formula: "0.45*(1-ALR) + 0.30*FCC + 0.25*(1-SICR)",
              thresholds: {
                warn: 0.72,
                fail: 0.58
              }
            },
            IPS: {
              formula: "0.50*CBC + 0.25*(1-BCR) + 0.25*SLA",
              thresholds: {
                warn: 0.72,
                fail: 0.58
              }
            },
            CTI: {
              formula:
                "0.20*DeployablesPerTeam + 0.15*PipelinesPerDeployable + 0.15*ContractsOrSchemasPerService + 0.10*DatastoresPerServiceGroup + 0.15*OnCallSurface + 0.10*SyncDepthOverhead + 0.15*RunCostPerBusinessTransaction"
            }
          },
          review: {
            require_human_if: ["confidence < 0.80", "breaking_change_detected == true"]
          }
        }
      },
      history_filters: {
        ignore_commit_patterns: ["^chore: format", "^chore: bump dependencies"],
        ignore_paths: ["package-lock.json", "pnpm-lock.yaml"]
      }
    }
  }
};

export async function loadPolicyConfig(policyPath?: string): Promise<PolicyConfig> {
  if (!policyPath) {
    return DEFAULT_POLICY;
  }
  return readDataFile<PolicyConfig>(policyPath);
}

export function getDomainPolicy(
  policyConfig: PolicyConfig,
  profileName: string,
  domainId: string
): DomainPolicy {
  const profile = policyConfig.profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown policy profile: ${profileName}`);
  }
  const domainPolicy = profile.domains[domainId];
  if (!domainPolicy) {
    throw new Error(`Unknown domain policy: ${domainId}`);
  }
  return domainPolicy;
}
