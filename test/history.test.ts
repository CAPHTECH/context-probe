import { describe } from "vitest";

import { registerHistoryComparisonTests } from "./history.comparison.js";
import { registerHistoryLocalityTests } from "./history.locality.js";
import { registerHistoryPersistenceTests } from "./history.persistence.js";

describe("history analysis", () => {
  registerHistoryLocalityTests();
  registerHistoryPersistenceTests();
  registerHistoryComparisonTests();
});
