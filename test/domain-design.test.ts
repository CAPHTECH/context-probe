import { afterEach, describe } from "vitest";

import { registerDomainDesignCoreTests } from "./domain-design.core.js";
import type { DomainDesignTestState } from "./domain-design.helpers.js";
import { registerDomainDesignHistoryTests } from "./domain-design.history.js";
import { registerDomainDesignPersistenceTests } from "./domain-design-persistence.js";
import { cleanupTemporaryRepo } from "./helpers.js";

describe("domain design analysis", () => {
  const state: DomainDesignTestState = { repoPath: undefined };

  afterEach(async () => {
    if (state.repoPath) {
      await cleanupTemporaryRepo(state.repoPath);
      state.repoPath = undefined;
    }
  });

  registerDomainDesignCoreTests(state);
  registerDomainDesignPersistenceTests(state);
  registerDomainDesignHistoryTests(state);
});
