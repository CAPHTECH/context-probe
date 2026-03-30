export {
  DRIFT_TOLERANCE,
  ELS_BASE_ENTRY,
  ELS_MODEL_PATH,
  MAX_THIN_HISTORY_CONFIDENCE,
  MAX_THIN_HISTORY_LOCALITY_SCORE,
  MIN_IMPROVEMENT_RATE,
  MIN_REPO_BACKED_ADVANTAGE_CASES,
  POLICY_PATH,
} from "./persistence-adoption.helpers-constants.js";
export { SYNTHETIC_MODEL } from "./persistence-adoption.helpers-model.js";
export {
  evaluateRealRepoReplacementGate,
  loadRealRepoManifestModels,
  loadRealRepoObservations,
} from "./persistence-adoption.helpers-real-repo.js";
export {
  cleanupPersistenceTempRoots,
  scoresPreferBetter,
  summarizeAdvantages,
} from "./persistence-adoption.helpers-summary.js";
export type {
  AcceptanceCase,
  AdvantageSummary,
  BenchmarkSummary,
  ComparisonEnvelope,
  ConfidenceCase,
  DeterminismCase,
  DriftCase,
  LocalityComparisonResult,
  RankingCase,
  RealRepoManifestModels,
  RealRepoReplacementGate,
} from "./persistence-adoption.helpers-types.js";
