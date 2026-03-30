export interface PurityFinding {
  kind: "adapter_leak" | "framework_contamination" | "shared_internal_component";
  path: string;
  source?: string;
  target?: string;
  sourceLayer?: string;
  targetLayer?: string;
  confidence: number;
  note: string;
}

export interface BoundaryPurityScore {
  ALR: number;
  FCC: number;
  SICR: number;
  confidence: number;
  unknowns: string[];
  findings: PurityFinding[];
}
