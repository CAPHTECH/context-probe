export {
  averageConfidence,
  averageLayerConfidence,
  mergeEvidence,
  mergeUnknowns,
} from "./scaffold-aggregation.js";
export { makeUniqueNames, normalizeName, toPascalCase, unique } from "./scaffold-naming.js";
export { createDefaultExtractionOptions } from "./scaffold-options.js";
export {
  AGGREGATE_FILE_PATTERN,
  CONTRACT_MARKERS,
  collectMarkerGlobs,
  groupSourceFiles,
  INTERNAL_MARKERS,
  inferGroupNames,
  inferRootGroupName,
  LAYER_PRIORITY_HINTS,
  STOPWORD_AGGREGATE_TERMS,
} from "./scaffold-source-groups.js";
export type {
  ArchitectureLayerCandidate,
  CodebaseAnalysis,
  DomainContextCandidate,
  ExtractionOptions,
  ScaffoldComputation,
  SourceGroup,
} from "./scaffold-types.js";
