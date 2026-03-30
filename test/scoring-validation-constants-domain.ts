import path from "node:path";

export const MCCS_MODEL_PATH = path.resolve("fixtures/validation/scoring/mccs/model.yaml");
export const MCCS_GOOD_ENTRY = "fixtures/validation/scoring/mccs/good-repo";
export const MCCS_BAD_ENTRY = "fixtures/validation/scoring/mccs/bad-repo";
export const ELS_MODEL_PATH = path.resolve("fixtures/validation/scoring/els/model.yaml");
export const ELS_BASE_ENTRY = "fixtures/validation/scoring/els/base-repo";
export const BFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/bfs/model.yaml");
export const BFS_GOOD_ENTRY = "fixtures/validation/scoring/bfs/good";
export const BFS_BAD_ENTRY = "fixtures/validation/scoring/bfs/bad-misaligned";
export const AFS_MODEL_PATH = path.resolve("fixtures/validation/scoring/afs/model.yaml");
export const AFS_GOOD_ENTRY = "fixtures/validation/scoring/afs/good";
export const AFS_BAD_ENTRY = "fixtures/validation/scoring/afs/bad-cross-transaction";
export const DRF_MODEL_PATH = path.resolve("fixtures/validation/scoring/drf/model.yaml");
export const DRF_GOOD_ENTRY = "fixtures/validation/scoring/drf/good";
export const DRF_BAD_ENTRY = "fixtures/validation/scoring/drf/bad-ambiguous";
export const ULI_MODEL_PATH = path.resolve("fixtures/validation/scoring/uli/model.yaml");
export const ULI_GOOD_ENTRY = "fixtures/validation/scoring/uli/good";
export const ULI_BAD_TRACE_ENTRY = "fixtures/validation/scoring/uli/bad-trace";
