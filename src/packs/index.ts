import type { DomainPack } from "../core/contracts.js";

const DOMAIN_DESIGN_PACK: DomainPack = {
  id: "domain_design",
  version: "0.1",
  commands: [
    "model.load",
    "model.scaffold",
    "code.detect_dependencies",
    "code.detect_contract_usage",
    "code.detect_boundary_leaks",
    "history.mine_cochange",
    "history.score_evolution_locality",
    "history.analyze_persistence",
    "history.compare_locality_models",
    "score.compute",
    "score.observe_shadow_rollout",
    "score.observe_shadow_rollout_batch",
    "gate.evaluate_shadow_rollout",
    "review.list_unknowns",
  ],
  metrics: ["MCCS", "ELS"],
  reviewRules: ["confidence < 0.75", "unknowns_count > 0"],
};

const ARCHITECTURE_DESIGN_PACK: DomainPack = {
  id: "architecture_design",
  version: "0.1",
  commands: [
    "constraints.scaffold",
    "arch.load_topology",
    "arch.detect_direction_violations",
    "arch.score_dependency_direction",
    "score.compute",
  ],
  metrics: ["DDS"],
  reviewRules: ["confidence < 0.80"],
};

const AI_CHANGE_REVIEW_PACK: DomainPack = {
  id: "ai_change_review",
  version: "0.1",
  commands: ["score.compute", "review.list_unknowns"],
  metrics: [],
  reviewRules: ["confidence < 0.75", "unknowns_count > 0"],
};

export const DOMAIN_PACKS: DomainPack[] = [DOMAIN_DESIGN_PACK, ARCHITECTURE_DESIGN_PACK, AI_CHANGE_REVIEW_PACK];
