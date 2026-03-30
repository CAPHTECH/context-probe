import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "./analyzers/code.js";
import { buildExtractionOptions, getDocsRoot, getRootPath, requireDomainModel } from "./command-helpers.js";
import type { CommandHandler } from "./command-types.js";
import { normalizeDocuments, registerArtifacts } from "./core/artifacts.js";
import { extractGlossary, extractInvariants, extractRules } from "./core/document-extractors.js";
import { createResponse, toProvenance } from "./core/response.js";
import { scaffoldDomainModel } from "./core/scaffold.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./core/trace.js";

export function createDomainCommands(): Record<string, CommandHandler> {
  return {
    async "ingest.register_artifacts"(args, context) {
      const artifacts = await registerArtifacts(getRootPath(args, context));
      return createResponse({ artifacts }, { provenance: [toProvenance(context.cwd, "artifact_registry")] });
    },

    async "ingest.normalize_documents"(args, context) {
      const fragments = await normalizeDocuments(getDocsRoot(args, context));
      return createResponse({ fragments }, { provenance: [toProvenance(context.cwd, "document_fragments")] });
    },

    async "model.load"(args, context) {
      const model = await requireDomainModel(args, context);
      return createResponse(model, { provenance: [toProvenance(context.cwd, "domain_model")] });
    },

    async "model.scaffold"(args, context) {
      const repoRoot = getRootPath(args, context);
      const docsRoot = typeof args["docs-root"] === "string" ? getDocsRoot(args, context) : undefined;
      const scaffold = await scaffoldDomainModel({
        repoRoot,
        ...(docsRoot ? { docsRoot, extractionOptions: await buildExtractionOptions(args, context) } : {}),
      });
      return createResponse(scaffold.result, {
        status: scaffold.unknowns.length > 0 ? "warning" : "ok",
        evidence: scaffold.evidence,
        confidence: scaffold.confidence,
        unknowns: scaffold.unknowns,
        diagnostics: scaffold.diagnostics,
        provenance: [
          toProvenance(repoRoot, "domain_model_scaffold"),
          ...(docsRoot ? [toProvenance(docsRoot, "domain_model_scaffold_docs")] : []),
        ],
      });
    },

    async "doc.extract_glossary"(args, context) {
      const glossary = await extractGlossary(await buildExtractionOptions(args, context));
      return createResponse(glossary, {
        status: glossary.diagnostics.length > 0 ? "warning" : "ok",
        evidence: glossary.terms.flatMap((term) => term.evidence),
        confidence: glossary.confidence,
        unknowns: glossary.unknowns,
        diagnostics: glossary.diagnostics,
        provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_glossary")],
      });
    },

    async "doc.extract_rules"(args, context) {
      const rules = await extractRules(await buildExtractionOptions(args, context));
      return createResponse(rules, {
        status: rules.diagnostics.length > 0 ? "warning" : "ok",
        evidence: rules.rules.flatMap((rule) => rule.evidence),
        confidence: rules.confidence,
        unknowns: rules.unknowns,
        diagnostics: rules.diagnostics,
        provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_rules")],
      });
    },

    async "doc.extract_invariants"(args, context) {
      const invariants = await extractInvariants(await buildExtractionOptions(args, context));
      return createResponse(invariants, {
        status: invariants.diagnostics.length > 0 ? "warning" : "ok",
        evidence: invariants.invariants.flatMap((invariant) => invariant.evidence),
        confidence: invariants.confidence,
        unknowns: invariants.unknowns,
        diagnostics: invariants.diagnostics,
        provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_invariants")],
      });
    },

    async "trace.link_terms"(args, context) {
      const glossary = await extractGlossary(await buildExtractionOptions(args, context));
      const codebase = typeof args.repo === "string" ? await parseCodebase(getRootPath(args, context)) : undefined;
      const links = await buildTermTraceLinks({
        docsRoot: getDocsRoot(args, context),
        ...(typeof args.repo === "string" ? { repoRoot: getRootPath(args, context) } : {}),
        ...(codebase ? { codeFiles: codebase.scorableSourceFiles } : {}),
        terms: glossary.terms,
      });
      return createResponse(
        {
          links,
          glossary: glossary.terms,
          metadata: glossary.metadata,
        },
        {
          status: glossary.diagnostics.length > 0 ? "warning" : "ok",
          evidence: glossary.terms.flatMap((term) => term.evidence),
          confidence: glossary.confidence,
          unknowns: glossary.unknowns,
          diagnostics: glossary.diagnostics,
          provenance: [toProvenance(getDocsRoot(args, context), "trace.link_terms")],
        },
      );
    },

    async "trace.link_model_to_code"(args, context) {
      const model = await requireDomainModel(args, context);
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse(
        {
          links: buildModelCodeLinks(model, codebase.scorableSourceFiles),
        },
        {
          provenance: [toProvenance(getRootPath(args, context), "trace.link_model_to_code")],
        },
      );
    },

    async "code.parse"(args, context) {
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse(codebase);
    },

    async "code.detect_dependencies"(args, context) {
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse({ dependencies: codebase.dependencies });
    },

    async "code.detect_contract_usage"(args, context) {
      const model = await requireDomainModel(args, context);
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse(detectContractUsage(codebase, model));
    },

    async "code.detect_boundary_leaks"(args, context) {
      const model = await requireDomainModel(args, context);
      const codebase = await parseCodebase(getRootPath(args, context));
      return createResponse({ findings: detectBoundaryLeaks(codebase, model) });
    },
  };
}
