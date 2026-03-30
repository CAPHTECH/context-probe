import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/core/contracts/**/*.ts"],
      thresholds: {
        lines: 55,
        functions: 55,
        statements: 55,
        branches: 45,
      },
    },
  },
});
