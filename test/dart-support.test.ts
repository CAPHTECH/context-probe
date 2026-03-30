import { describe } from "vitest";

import { registerDartSupportArchitectureDesignTests } from "./dart-support.architecture-design.js";
import { registerDartSupportDomainDesignTests } from "./dart-support.domain-design.js";
import { registerDartSupportParsingTests } from "./dart-support.parsing.js";
import { registerDartSupportTraceTests } from "./dart-support.trace.js";

describe("dart support", () => {
  registerDartSupportParsingTests();
  registerDartSupportTraceTests();
  registerDartSupportDomainDesignTests();
  registerDartSupportArchitectureDesignTests();
});
