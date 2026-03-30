import type { PolicyConfig } from "./contracts.js";
import { buildDefaultPolicyProfiles } from "./policy-defaults-profiles.js";

export const DEFAULT_POLICY: PolicyConfig = {
  profiles: buildDefaultPolicyProfiles(),
};
