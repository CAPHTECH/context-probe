import type { ArchitectureConstraints, CodebaseAnalysis } from "../core/contracts.js";
import { recordComplexityTaxComponents } from "./cti-complexity-components.js";
import { type ComplexityTaxScore, createComplexityTaxRecorder } from "./cti-complexity-recorder.js";

export type { ComplexityTaxFinding, ComplexityTaxScore } from "./cti-complexity-recorder.js";

export function scoreComplexityTax(options: {
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
}): ComplexityTaxScore {
  const { codebase, constraints } = options;
  const metadata = constraints.complexity;
  const recorder = createComplexityTaxRecorder(constraints);
  recordComplexityTaxComponents({
    codebase,
    context: { constraints, metadata, recorder },
  });

  if (!metadata) {
    recorder.noteUnknown("Constraints do not include complexity metadata, so CTI is only partially observed.");
  }
  return recorder.finalize();
}
