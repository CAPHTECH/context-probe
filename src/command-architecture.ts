import { detectDirectionViolations, scoreDependencyDirection } from "./analyzers/architecture.js";
import { parseCodebase } from "./analyzers/code.js";
import { getRootPath, requireArchitectureConstraints } from "./command-helpers.js";
import type { CommandHandler } from "./command-types.js";
import { createResponse, toProvenance } from "./core/response.js";
import { scaffoldArchitectureConstraints } from "./core/scaffold.js";

export function createArchitectureCommands(): Record<string, CommandHandler> {
  return {
    async "arch.load_topology"(args, context) {
      const constraints = await requireArchitectureConstraints(args, context);
      return createResponse(constraints);
    },

    async "constraints.scaffold"(args, context) {
      const repoRoot = getRootPath(args, context);
      const scaffold = await scaffoldArchitectureConstraints({ repoRoot });
      return createResponse(scaffold.result, {
        status: scaffold.unknowns.length > 0 ? "warning" : "ok",
        evidence: scaffold.evidence,
        confidence: scaffold.confidence,
        unknowns: scaffold.unknowns,
        diagnostics: scaffold.diagnostics,
        provenance: [toProvenance(repoRoot, "architecture_constraints_scaffold")],
      });
    },

    async "arch.detect_direction_violations"(args, context) {
      const constraints = await requireArchitectureConstraints(args, context);
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse({ violations: detectDirectionViolations(codebase, constraints) });
    },

    async "arch.score_dependency_direction"(args, context) {
      const constraints = await requireArchitectureConstraints(args, context);
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse(scoreDependencyDirection(codebase, constraints));
    },
  };
}
