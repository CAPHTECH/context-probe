import { promises as fs } from "node:fs";

import type {
  ArchitectureBoundaryMap,
  ArchitectureConstraints,
  ArchitectureDeliveryNormalizationProfile,
  ArchitectureDeliveryObservationSet,
  ArchitectureDeliveryRawObservationSet,
  ArchitecturePatternRuntimeObservationSet,
  ArchitectureTelemetryNormalizationProfile,
  ArchitectureTopologyModel,
  ArchitectureScenarioCatalog,
  ArchitectureTelemetryObservationSet,
  ArchitectureTelemetryRawObservationSet,
  CommandContext,
  CommandResponse,
  DomainModel,
  ExtractionBackend,
  ExtractionProviderName,
  ReviewItem,
  ReviewResolution,
  ReviewResolutionLog,
  ScenarioObservationSet,
  TopologyRuntimeObservationSet
} from "./core/contracts.js";
import { normalizeDocuments, registerArtifacts } from "./core/artifacts.js";
import {
  extractGlossary,
  extractInvariants,
  extractRules
} from "./core/document-extractors.js";
import { normalizeHistory, scoreEvolutionLocality } from "./core/history.js";
import { readDataFile } from "./core/io.js";
import { loadArchitectureConstraints, loadDomainModel } from "./core/model.js";
import { loadPolicyConfig } from "./core/policy.js";
import { renderMarkdownReport, evaluateGate } from "./core/report.js";
import { applyReviewOverrides, listReviewItems, resolveReviewItems } from "./core/review.js";
import { createResponse, mergeStatus, toProvenance } from "./core/response.js";
import { computeArchitectureScores, computeDomainDesignScores } from "./core/scoring.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./core/trace.js";
import { detectDirectionViolations, scoreDependencyDirection } from "./analyzers/architecture.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "./analyzers/code.js";
import { DOMAIN_PACKS } from "./packs/index.js";

export type CommandHandler = (
  args: Record<string, string | boolean>,
  context: CommandContext
) => Promise<CommandResponse<unknown>>;

async function requireDomainModel(args: Record<string, string | boolean>, context: CommandContext): Promise<DomainModel> {
  const modelPath = typeof args.model === "string" ? args.model : undefined;
  if (!modelPath) {
    throw new Error("`--model` is required");
  }
  return loadDomainModel(new URL(modelPath, `file://${context.cwd}/`).pathname);
}

async function requireArchitectureConstraints(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureConstraints> {
  const constraintsPath = typeof args.constraints === "string" ? args.constraints : undefined;
  if (!constraintsPath) {
    throw new Error("`--constraints` is required");
  }
  return loadArchitectureConstraints(new URL(constraintsPath, `file://${context.cwd}/`).pathname);
}

async function loadScenarioCatalogIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureScenarioCatalog | undefined> {
  const scenarioCatalogPath =
    typeof args["scenario-catalog"] === "string"
      ? new URL(args["scenario-catalog"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!scenarioCatalogPath) {
    return undefined;
  }
  return readDataFile<ArchitectureScenarioCatalog>(scenarioCatalogPath);
}

async function loadScenarioObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ScenarioObservationSet | undefined> {
  const observationsPath =
    typeof args["scenario-observations"] === "string"
      ? new URL(args["scenario-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!observationsPath) {
    return undefined;
  }
  return readDataFile<ScenarioObservationSet>(observationsPath);
}

async function loadTopologyModelIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureTopologyModel | undefined> {
  const topologyPath =
    typeof args["topology-model"] === "string"
      ? new URL(args["topology-model"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!topologyPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTopologyModel>(topologyPath);
}

async function loadBoundaryMapIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureBoundaryMap | undefined> {
  const boundaryMapPath =
    typeof args["boundary-map"] === "string"
      ? new URL(args["boundary-map"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!boundaryMapPath) {
    return undefined;
  }
  return readDataFile<ArchitectureBoundaryMap>(boundaryMapPath);
}

async function loadRuntimeObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<TopologyRuntimeObservationSet | undefined> {
  const runtimePath =
    typeof args["runtime-observations"] === "string"
      ? new URL(args["runtime-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!runtimePath) {
    return undefined;
  }
  return readDataFile<TopologyRuntimeObservationSet>(runtimePath);
}

async function loadDeliveryObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureDeliveryObservationSet | undefined> {
  const deliveryPath =
    typeof args["delivery-observations"] === "string"
      ? new URL(args["delivery-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!deliveryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryObservationSet>(deliveryPath);
}

async function loadDeliveryRawObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureDeliveryRawObservationSet | undefined> {
  const deliveryPath =
    typeof args["delivery-raw-observations"] === "string"
      ? new URL(args["delivery-raw-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!deliveryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryRawObservationSet>(deliveryPath);
}

async function loadDeliveryNormalizationProfileIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureDeliveryNormalizationProfile | undefined> {
  const profilePath =
    typeof args["delivery-normalization-profile"] === "string"
      ? new URL(args["delivery-normalization-profile"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!profilePath) {
    return undefined;
  }
  return readDataFile<ArchitectureDeliveryNormalizationProfile>(profilePath);
}

async function loadTelemetryObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureTelemetryObservationSet | undefined> {
  const telemetryPath =
    typeof args["telemetry-observations"] === "string"
      ? new URL(args["telemetry-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!telemetryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryObservationSet>(telemetryPath);
}

async function loadTelemetryRawObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureTelemetryRawObservationSet | undefined> {
  const telemetryPath =
    typeof args["telemetry-raw-observations"] === "string"
      ? new URL(args["telemetry-raw-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!telemetryPath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryRawObservationSet>(telemetryPath);
}

async function loadTelemetryNormalizationProfileIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitectureTelemetryNormalizationProfile | undefined> {
  const profilePath =
    typeof args["telemetry-normalization-profile"] === "string"
      ? new URL(args["telemetry-normalization-profile"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!profilePath) {
    return undefined;
  }
  return readDataFile<ArchitectureTelemetryNormalizationProfile>(profilePath);
}

async function loadPatternRuntimeObservationsIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ArchitecturePatternRuntimeObservationSet | undefined> {
  const runtimePath =
    typeof args["pattern-runtime-observations"] === "string"
      ? new URL(args["pattern-runtime-observations"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!runtimePath) {
    return undefined;
  }
  return readDataFile<ArchitecturePatternRuntimeObservationSet>(runtimePath);
}

function getRootPath(args: Record<string, string | boolean>, context: CommandContext): string {
  return typeof args.repo === "string"
    ? new URL(args.repo, `file://${context.cwd}/`).pathname
    : context.cwd;
}

function getDocsRoot(args: Record<string, string | boolean>, context: CommandContext): string {
  return typeof args["docs-root"] === "string"
    ? new URL(args["docs-root"], `file://${context.cwd}/`).pathname
    : context.cwd;
}

function getProfile(args: Record<string, string | boolean>): string {
  return typeof args.profile === "string" ? args.profile : "default";
}

function getExtractor(args: Record<string, string | boolean>): ExtractionBackend {
  return args.extractor === "cli" ? "cli" : "heuristic";
}

function getProvider(args: Record<string, string | boolean>): ExtractionProviderName | undefined {
  if (args.provider === "codex" || args.provider === "claude") {
    return args.provider;
  }
  return undefined;
}

function getPromptProfile(args: Record<string, string | boolean>): string {
  return typeof args["prompt-profile"] === "string" ? args["prompt-profile"] : "default";
}

function getFallback(args: Record<string, string | boolean>): "heuristic" | "none" {
  return args.fallback === "none" ? "none" : "heuristic";
}

async function loadReviewLogIfRequested(
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<ReviewResolutionLog | undefined> {
  const reviewLogPath =
    typeof args["review-log"] === "string"
      ? new URL(args["review-log"], `file://${context.cwd}/`).pathname
      : undefined;
  if (!reviewLogPath) {
    return undefined;
  }
  return readDataFile<ReviewResolutionLog>(reviewLogPath);
}

async function buildExtractionOptions(args: Record<string, string | boolean>, context: CommandContext) {
  const provider = getProvider(args);
  const providerCommand = typeof args["provider-cmd"] === "string" ? args["provider-cmd"] : undefined;
  const reviewLog = await loadReviewLogIfRequested(args, context);
  return {
    root: getDocsRoot(args, context),
    cwd: context.cwd,
    extractor: getExtractor(args),
    ...(provider ? { provider } : {}),
    ...(providerCommand ? { providerCommand } : {}),
    promptProfile: getPromptProfile(args),
    fallback: getFallback(args),
    ...(reviewLog ? { reviewLog } : {}),
    applyReviewLog: args["apply-review-log"] === true
  } as const;
}

export const COMMANDS: Record<string, CommandHandler> = {
  async "ingest.register_artifacts"(args, context) {
    const artifacts = await registerArtifacts(getRootPath(args, context));
    return createResponse({ artifacts }, { provenance: [toProvenance(context.cwd, "artifact_registry")] });
  },

  async "ingest.normalize_documents"(args, context) {
    const fragments = await normalizeDocuments(getDocsRoot(args, context));
    return createResponse({ fragments }, { provenance: [toProvenance(context.cwd, "document_fragments")] });
  },

  async "ingest.normalize_history"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    return createResponse({ commits }, { provenance: [toProvenance(context.cwd, "history_registry")] });
  },

  async "model.load"(args, context) {
    const model = await requireDomainModel(args, context);
    return createResponse(model, { provenance: [toProvenance(context.cwd, "domain_model")] });
  },

  async "doc.extract_glossary"(args, context) {
    const glossary = await extractGlossary(await buildExtractionOptions(args, context));
    return createResponse(glossary, {
      status: glossary.diagnostics.length > 0 ? "warning" : "ok",
      evidence: glossary.terms.flatMap((term) => term.evidence),
      confidence: glossary.confidence,
      unknowns: glossary.unknowns,
      diagnostics: glossary.diagnostics,
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_glossary")]
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
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_rules")]
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
      provenance: [toProvenance(getDocsRoot(args, context), "doc.extract_invariants")]
    });
  },

  async "trace.link_terms"(args, context) {
    const glossary = await extractGlossary(await buildExtractionOptions(args, context));
    const links = await buildTermTraceLinks({
      docsRoot: getDocsRoot(args, context),
      ...(typeof args.repo === "string" ? { repoRoot: getRootPath(args, context) } : {}),
      terms: glossary.terms
    });
    return createResponse(
      {
        links,
        glossary: glossary.terms,
        metadata: glossary.metadata
      },
      {
        status: glossary.diagnostics.length > 0 ? "warning" : "ok",
        evidence: glossary.terms.flatMap((term) => term.evidence),
        confidence: glossary.confidence,
        unknowns: glossary.unknowns,
        diagnostics: glossary.diagnostics,
        provenance: [toProvenance(getDocsRoot(args, context), "trace.link_terms")]
      }
    );
  },

  async "trace.link_model_to_code"(args, context) {
    const model = await requireDomainModel(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(
      {
        links: buildModelCodeLinks(model, codebase.sourceFiles)
      },
      {
        provenance: [toProvenance(getRootPath(args, context), "trace.link_model_to_code")]
      }
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

  async "history.mine_cochange"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    return createResponse({ commits });
  },

  async "history.score_evolution_locality"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    return createResponse(scoreEvolutionLocality(commits, model));
  },

  async "arch.load_topology"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    return createResponse(constraints);
  },

  async "arch.detect_direction_violations"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse({ violations: detectDirectionViolations(codebase, constraints) });
  },

  async "arch.score_dependency_direction"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    const codebase = await parseCodebase(getRootPath(args, context));
    return createResponse(scoreDependencyDirection(codebase, constraints));
  },

  async "score.compute"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const domain = typeof args.domain === "string" ? args.domain : "domain_design";
    if (domain === "architecture_design") {
      const constraints = await requireArchitectureConstraints(args, context);
      const [
        scenarioCatalog,
        scenarioObservations,
        topologyModel,
        boundaryMap,
        runtimeObservations,
        deliveryObservations,
        deliveryRawObservations,
        deliveryNormalizationProfile,
        telemetryObservations,
        telemetryRawObservations,
        telemetryNormalizationProfile,
        patternRuntimeObservations
      ] = await Promise.all([
        loadScenarioCatalogIfRequested(args, context),
        loadScenarioObservationsIfRequested(args, context),
        loadTopologyModelIfRequested(args, context),
        loadBoundaryMapIfRequested(args, context),
        loadRuntimeObservationsIfRequested(args, context),
        loadDeliveryObservationsIfRequested(args, context),
        loadDeliveryRawObservationsIfRequested(args, context),
        loadDeliveryNormalizationProfileIfRequested(args, context),
        loadTelemetryObservationsIfRequested(args, context),
        loadTelemetryRawObservationsIfRequested(args, context),
        loadTelemetryNormalizationProfileIfRequested(args, context),
        loadPatternRuntimeObservationsIfRequested(args, context)
      ]);
      return computeArchitectureScores({
        repoPath: getRootPath(args, context),
        constraints,
        policyConfig,
        profileName: getProfile(args),
        ...(scenarioCatalog ? { scenarioCatalog } : {}),
        ...(scenarioObservations ? { scenarioObservations } : {}),
        ...(topologyModel ? { topologyModel } : {}),
        ...(boundaryMap ? { boundaryMap } : {}),
        ...(runtimeObservations ? { runtimeObservations } : {}),
        ...(deliveryObservations ? { deliveryObservations } : {}),
        ...(deliveryRawObservations ? { deliveryRawObservations } : {}),
        ...(deliveryNormalizationProfile ? { deliveryNormalizationProfile } : {}),
        ...(telemetryObservations ? { telemetryObservations } : {}),
        ...(telemetryRawObservations ? { telemetryRawObservations } : {}),
        ...(telemetryNormalizationProfile ? { telemetryNormalizationProfile } : {}),
        ...(patternRuntimeObservations ? { patternRuntimeObservations } : {})
      });
    }
    const model = await requireDomainModel(args, context);
    const docsRoot = typeof args["docs-root"] === "string" ? getDocsRoot(args, context) : undefined;
    const extractionOptions = docsRoot ? await buildExtractionOptions(args, context) : undefined;
    return computeDomainDesignScores({
      repoPath: getRootPath(args, context),
      model,
      policyConfig,
      profileName: getProfile(args),
      ...(docsRoot ? { docsRoot } : {}),
      ...(extractionOptions
        ? {
            extraction: {
              extractor: extractionOptions.extractor,
              ...(extractionOptions.provider ? { provider: extractionOptions.provider } : {}),
              ...(extractionOptions.providerCommand ? { providerCommand: extractionOptions.providerCommand } : {}),
              promptProfile: extractionOptions.promptProfile,
              fallback: extractionOptions.fallback,
              ...(extractionOptions.reviewLog ? { reviewLog: extractionOptions.reviewLog } : {}),
              applyReviewLog: extractionOptions.applyReviewLog
            }
          }
        : {})
    });
  },

  async "review.list_unknowns"(args, context) {
    const inputPath = typeof args.input === "string" ? new URL(args.input, `file://${context.cwd}/`).pathname : undefined;
    const sourceCommand =
      typeof args["source-command"] === "string" ? COMMANDS[args["source-command"]] : undefined;
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = inputPath
      ? (await readDataFile<CommandResponse<unknown>>(inputPath))
      : sourceCommand
        ? await sourceCommand(args, context)
        : await scoreCompute(args, context);
    const reviewItems = listReviewItems(response);
    return createResponse(
      { reviewItems },
      {
        status: reviewItems.length > 0 ? "warning" : "ok",
        confidence: response.confidence,
        unknowns: response.unknowns,
        evidence: response.evidence,
        diagnostics: response.diagnostics,
        provenance: response.provenance
      }
    );
  },

  async "review.resolve"(args, context) {
    const reviewItemsPath = typeof args["review-items"] === "string"
      ? new URL(args["review-items"], `file://${context.cwd}/`).pathname
      : undefined;
    const resolutionsPath = typeof args.resolutions === "string"
      ? new URL(args.resolutions, `file://${context.cwd}/`).pathname
      : undefined;
    if (!reviewItemsPath || !resolutionsPath) {
      throw new Error("`--review-items` and `--resolutions` are required");
    }
    const reviewItemsPayload = await readDataFile<{ reviewItems?: ReviewItem[]; result?: { reviewItems?: ReviewItem[] } }>(
      reviewItemsPath
    );
    const reviewItems = reviewItemsPayload.reviewItems ?? reviewItemsPayload.result?.reviewItems ?? [];
    const resolutions = await readDataFile<ReviewResolution[]>(
      resolutionsPath
    );
    const resolutionLog = resolveReviewItems(reviewItems, resolutions);
    return createResponse(
      resolutionLog,
      {
        status: resolutionLog.overrides.length > 0 ? "warning" : "ok",
        confidence: 0.9,
        provenance: [toProvenance(reviewItemsPath, "review.resolve"), toProvenance(resolutionsPath, "review.resolve")]
      }
    );
  },

  async "report.generate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = (await scoreCompute(args, context)) as CommandResponse<{
      domainId: string;
      metrics: Array<{
        metricId: string;
        value: number;
        components: Record<string, number>;
        confidence: number;
        evidenceRefs: string[];
        unknowns: string[];
      }>;
      leakFindings?: unknown[];
      violations?: unknown[];
    }>;
    const format = typeof args.format === "string" ? args.format : "json";
    if (format === "md") {
      return createResponse(
        {
          format,
          report: renderMarkdownReport(response)
        },
        {
          status: response.status,
          evidence: response.evidence,
          confidence: response.confidence,
          unknowns: response.unknowns,
          diagnostics: response.diagnostics,
          provenance: response.provenance
        }
      );
    }
    return response;
  },

  async "gate.evaluate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = (await scoreCompute(args, context)) as CommandResponse<{
      domainId: string;
      metrics: Array<{
        metricId: string;
        value: number;
        components: Record<string, number>;
        confidence: number;
        evidenceRefs: string[];
        unknowns: string[];
      }>;
    }>;
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const gate = evaluateGate(response, policyConfig, getProfile(args));
    return createResponse(
      {
        domainId: response.result.domainId,
        gate,
        metrics: response.result.metrics
      },
      {
        status: gate.status,
        evidence: response.evidence,
        confidence: response.confidence,
        unknowns: response.unknowns,
        diagnostics: [...response.diagnostics, `Available packs: ${DOMAIN_PACKS.map((pack) => pack.id).join(", ")}`]
      }
    );
  }
};

export function listCommands(): string[] {
  return Object.keys(COMMANDS).sort();
}

export async function maybeWriteOutput(
  response: CommandResponse<unknown>,
  args: Record<string, string | boolean>,
  context: CommandContext
): Promise<void> {
  const output = typeof args.output === "string" ? new URL(args.output, `file://${context.cwd}/`).pathname : undefined;
  if (!output) {
    return;
  }
  await fs.writeFile(output, JSON.stringify(response, null, 2), "utf8");
}
