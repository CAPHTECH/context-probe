import type { DomainPolicy, PolicyConfig } from "./contracts.js";
import { readDataFile } from "./io.js";
import { DEFAULT_POLICY } from "./policy-defaults.js";

export { DEFAULT_POLICY } from "./policy-defaults.js";

export async function loadPolicyConfig(policyPath?: string): Promise<PolicyConfig> {
  if (!policyPath) {
    return DEFAULT_POLICY;
  }
  return readDataFile<PolicyConfig>(policyPath);
}

export function getDomainPolicy(policyConfig: PolicyConfig, profileName: string, domainId: string): DomainPolicy {
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
