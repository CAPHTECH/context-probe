import type { DomainPack } from "../core/contracts.js";

export const DOMAIN_DESIGN_PACK: DomainPack = {
  id: "domain_design",
  version: "0.1",
  commands: [
    "model.load",
    "code.detect_dependencies",
    "code.detect_contract_usage",
    "code.detect_boundary_leaks",
    "history.mine_cochange",
    "history.score_evolution_locality",
    "score.compute",
    "review.list_unknowns"
  ],
  metrics: ["MCCS", "ELS"],
  reviewRules: ["confidence < 0.75", "unknowns_count > 0"]
};

export const ARCHITECTURE_DESIGN_PACK: DomainPack = {
  id: "architecture_design",
  version: "0.1",
  commands: [
    "arch.load_topology",
    "arch.detect_direction_violations",
    "arch.score_dependency_direction",
    "score.compute"
  ],
  metrics: ["DDS"],
  reviewRules: ["confidence < 0.80"]
};

export const DOMAIN_PACKS: DomainPack[] = [DOMAIN_DESIGN_PACK, ARCHITECTURE_DESIGN_PACK];
