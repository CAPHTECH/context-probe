import { describe, expect, test } from "vitest";

import { COMMANDS } from "../src/commands.js";
import { ARCHITECTURE_CONSTRAINTS_PATH, CONTEXT } from "./command-surface.helpers.js";

describe("command surface architecture helpers", () => {
  test("architecture helper commands operate against the repository self-measurement inputs", async () => {
    const topology = await COMMANDS["arch.load_topology"]!({ constraints: ARCHITECTURE_CONSTRAINTS_PATH }, CONTEXT);
    const direction = await COMMANDS["arch.score_dependency_direction"]!(
      { repo: ".", constraints: ARCHITECTURE_CONSTRAINTS_PATH },
      CONTEXT,
    );
    const violations = await COMMANDS["arch.detect_direction_violations"]!(
      { repo: ".", constraints: ARCHITECTURE_CONSTRAINTS_PATH },
      CONTEXT,
    );

    expect((topology.result as { layers: unknown[] }).layers.length).toBeGreaterThan(0);
    expect((direction.result as { IDR?: number }).IDR).toBeGreaterThanOrEqual(0);
    expect(Array.isArray((violations.result as { violations: unknown[] }).violations)).toBe(true);
  }, 60000);
});
