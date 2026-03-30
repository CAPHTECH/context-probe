import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { registerDomainDesignPersistencePilotTests } from "./domain-design-persistence-pilot.js";
import { registerDomainDesignPersistenceReportingTests } from "./domain-design-persistence-reporting.js";
import { registerDomainDesignPersistenceShadowTests } from "./domain-design-persistence-shadow.js";

export function registerDomainDesignPersistenceTests(state: DomainDesignTestState): void {
  registerDomainDesignPersistenceShadowTests(state);
  registerDomainDesignPersistencePilotTests(state);
  registerDomainDesignPersistenceReportingTests(state);
}
