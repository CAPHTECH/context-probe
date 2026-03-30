import type { Evidence } from "./common.js";

export interface ContextDefinition {
  name: string;
  pathGlobs: string[];
  contractGlobs?: string[];
  internalGlobs?: string[];
}

export interface AggregateDefinition {
  name: string;
  context: string;
  aliases?: string[];
}

export interface DomainModel {
  version: string;
  contexts: ContextDefinition[];
  aggregates?: AggregateDefinition[];
}

export interface DomainContextCandidate {
  definition: ContextDefinition;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
}

export interface DomainAggregateCandidate {
  definition: AggregateDefinition;
  confidence: number;
  evidence: Evidence[];
  unknowns: string[];
}

export interface DomainModelScaffoldResult {
  model: DomainModel;
  yaml: string;
  contexts: DomainContextCandidate[];
  aggregates: DomainAggregateCandidate[];
}
