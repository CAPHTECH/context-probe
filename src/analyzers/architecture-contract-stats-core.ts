import type { ArchitectureConstraints, CodebaseAnalysis } from "../core/contracts.js";
import type { ContractFileStats } from "./architecture-contract-stats-file.js";
import { analyzeContractFileStats } from "./architecture-contract-stats-file.js";
import { collectContractFilePaths } from "./contract-files.js";

export type { ContractFileStats } from "./architecture-contract-stats-file.js";

export async function collectContractFileStats(options: {
  root: string;
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
}): Promise<ContractFileStats[]> {
  const contractPaths = collectContractFilePaths({
    codebase: options.codebase,
    constraints: options.constraints,
    allowDartDomainFallback: true,
  });
  const contractFiles = new Set(contractPaths);
  const fileMap = new Map(options.codebase.files.map((file) => [file.path, file]));

  return Promise.all(
    contractPaths.map((filePath) =>
      analyzeContractFileStats({
        root: options.root,
        path: filePath,
        codebase: options.codebase,
        constraints: options.constraints,
        contractFiles,
        fileMap,
      }),
    ),
  );
}

export { toContractBaselineEntry } from "./architecture-contract-stats-file.js";
