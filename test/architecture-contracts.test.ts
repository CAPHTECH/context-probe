import { describe } from "vitest";

import { registerArchitectureContractBaselineTests } from "./architecture-contracts.baseline.js";
import { registerArchitectureContractCommandTests } from "./architecture-contracts.command.js";
import { registerArchitectureContractScopeTests } from "./architecture-contracts.scope.js";

describe("architecture contract scope", () => {
  registerArchitectureContractScopeTests();
  registerArchitectureContractBaselineTests();
  registerArchitectureContractCommandTests();
});
