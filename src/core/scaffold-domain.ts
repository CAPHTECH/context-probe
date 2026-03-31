import YAML from "yaml";

import { parseCodebase } from "../analyzers/code.js";
import type { DomainModel, DomainModelScaffoldResult } from "./contracts.js";
import { clampConfidence } from "./response.js";
import { buildAggregateCandidates } from "./scaffold-domain-aggregates.js";
import { buildContextCandidates } from "./scaffold-domain-contexts.js";
import { buildDocsBundle } from "./scaffold-domain-docs.js";
import {
  averageConfidence,
  type ExtractionOptions,
  mergeEvidence,
  mergeUnknowns,
  type ScaffoldComputation,
  unique,
} from "./scaffold-shared.js";

export async function scaffoldDomainModel(options: {
  repoRoot: string;
  docsRoot?: string;
  extractionOptions?: ExtractionOptions;
}): Promise<ScaffoldComputation<DomainModelScaffoldResult>> {
  const codebase = await parseCodebase(options.repoRoot);
  const docsBundle = options.docsRoot
    ? await buildDocsBundle(options.repoRoot, options.docsRoot, codebase, options.extractionOptions)
    : undefined;

  const contextCandidates = buildContextCandidates(
    codebase,
    docsBundle
      ? {
          fragments: docsBundle.glossary.fragments,
          terms: docsBundle.glossary.terms,
          termLinks: docsBundle.termLinks,
        }
      : undefined,
  );
  const aggregateCandidates = buildAggregateCandidates(contextCandidates, docsBundle);

  const model: DomainModel = {
    version: "1.0",
    contexts: contextCandidates.map((entry) => entry.candidate.definition),
    ...(aggregateCandidates.length > 0
      ? {
          aggregates: aggregateCandidates.map((candidate) => candidate.definition),
        }
      : {}),
  };

  const result: DomainModelScaffoldResult = {
    model,
    yaml: YAML.stringify(model),
    contexts: contextCandidates.map((entry) => entry.candidate),
    aggregates: aggregateCandidates,
  };

  const extractionSignals = docsBundle
    ? [docsBundle.glossary.confidence, docsBundle.rules.confidence, docsBundle.invariants.confidence]
    : [];
  const confidence = clampConfidence(averageConfidence(contextCandidates, aggregateCandidates, extractionSignals));

  const unknowns = mergeUnknowns(
    [...contextCandidates.map((entry) => entry.candidate), ...aggregateCandidates],
    [
      ...(docsBundle
        ? [...docsBundle.glossary.unknowns, ...docsBundle.rules.unknowns, ...docsBundle.invariants.unknowns]
        : ["No docs root was provided, so aggregate candidates rely on code structure only."]),
      ...(aggregateCandidates.length === 0
        ? ["No aggregate candidates were observed; review whether aggregates should be declared explicitly."]
        : []),
    ],
  );

  const diagnostics = unique(
    [
      ...(docsBundle
        ? [...docsBundle.glossary.diagnostics, ...docsBundle.rules.diagnostics, ...docsBundle.invariants.diagnostics]
        : []),
      `Scaffolded ${contextCandidates.length} context candidate(s).`,
      `Scaffolded ${aggregateCandidates.length} aggregate candidate(s).`,
    ].filter((entry) => entry.length > 0),
  );

  return {
    result,
    confidence,
    evidence: mergeEvidence([...contextCandidates.map((entry) => entry.candidate), ...aggregateCandidates]),
    unknowns,
    diagnostics,
  };
}
