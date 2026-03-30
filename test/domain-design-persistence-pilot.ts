import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { registerDomainDesignPersistencePilotApplicationTests } from "./domain-design-persistence-pilot.application.js";
import { registerDomainDesignPersistencePilotFallbackTests } from "./domain-design-persistence-pilot.fallback.js";
import { registerDomainDesignPersistencePilotMetricTests } from "./domain-design-persistence-pilot.metrics.js";
import { registerDomainDesignPersistencePilotToolingTests } from "./domain-design-persistence-pilot.tooling.js";

export function registerDomainDesignPersistencePilotTests(state: DomainDesignTestState): void {
  registerDomainDesignPersistencePilotApplicationTests(state);
  registerDomainDesignPersistencePilotToolingTests(state);
  registerDomainDesignPersistencePilotFallbackTests();
  registerDomainDesignPersistencePilotMetricTests(state);
}
