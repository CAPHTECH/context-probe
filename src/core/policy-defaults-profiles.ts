import type { PolicyConfig } from "./contracts.js";
import { createArchitectureDesignPolicy } from "./policy-defaults-architecture.js";
import { createDomainDesignPolicy } from "./policy-defaults-domain.js";
import {
  CQRS_APSI_FORMULA,
  DEFAULT_APSI_FORMULA,
  EVENT_DRIVEN_APSI_FORMULA,
  LAYERED_APSI_FORMULA,
  SERVICE_BASED_APSI_FORMULA,
} from "./policy-formulas.js";

function createProfile(apsiFormula: string): PolicyConfig["profiles"][string] {
  return {
    domains: {
      domain_design: createDomainDesignPolicy(),
      architecture_design: createArchitectureDesignPolicy(apsiFormula),
    },
    history_filters: {
      ignore_commit_patterns: ["^chore: format", "^chore: bump dependencies"],
      ignore_paths: ["package-lock.json", "pnpm-lock.yaml"],
    },
  };
}

export function buildDefaultPolicyProfiles(): PolicyConfig["profiles"] {
  return {
    default: createProfile(DEFAULT_APSI_FORMULA),
    layered: createProfile(LAYERED_APSI_FORMULA),
    service_based: createProfile(SERVICE_BASED_APSI_FORMULA),
    cqrs: createProfile(CQRS_APSI_FORMULA),
    event_driven: createProfile(EVENT_DRIVEN_APSI_FORMULA),
  };
}
