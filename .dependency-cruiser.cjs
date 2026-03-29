module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies hide module ownership and make safe refactoring harder.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "All imports in src/ must resolve on disk or through configured package dependencies.",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: "no-analyzers-to-surface",
      severity: "error",
      comment: "Analyzers should stay independent from the command and pack surfaces.",
      from: {
        path: "^src/analyzers/"
      },
      to: {
        path: "^src/(commands\\.ts|cli\\.ts|packs/)"
      }
    },
    {
      name: "no-core-to-surface",
      severity: "error",
      comment: "Core modules should not depend on the CLI or command orchestration layer.",
      from: {
        path: "^src/core/"
      },
      to: {
        path: "^src/(commands\\.ts|cli\\.ts)$"
      }
    },
    {
      name: "no-packs-to-implementation",
      severity: "error",
      comment: "Pack registration should stay declarative and avoid runtime implementation modules.",
      from: {
        path: "^src/packs/"
      },
      to: {
        path: "^src/(analyzers/|commands\\.ts|cli\\.ts|command-helpers\\.ts$)"
      }
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      extensions: [".ts", ".js", ".json"],
    },
  },
};
