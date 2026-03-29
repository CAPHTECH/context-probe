import { promises as fs } from "node:fs";
import path from "node:path";
import { detectDirectionViolations, scoreDependencyDirection } from "./analyzers/architecture.js";
import {
  resolveComplexitySourceConfig,
  resolveDeliverySourceConfig,
  resolveScenarioObservationSourceConfig,
  resolveTelemetrySourceConfig,
} from "./analyzers/architecture-source-loader.js";
import { detectBoundaryLeaks, detectContractUsage, parseCodebase } from "./analyzers/code.js";
import type { CommandArgs } from "./command-helpers.js";
import {
  buildExtractionOptions,
  getDocsRoot,
  getProfile,
  getRootPath,
  loadBoundaryMapIfRequested,
  loadComplexityExportIfRequested,
  loadComplexitySourceConfigIfRequested,
  loadDeliveryExportIfRequested,
  loadDeliveryNormalizationProfileIfRequested,
  loadDeliveryObservationsIfRequested,
  loadDeliveryRawObservationsIfRequested,
  loadDeliverySourceConfigIfRequested,
  loadPatternRuntimeNormalizationProfileIfRequested,
  loadPatternRuntimeObservationsIfRequested,
  loadPatternRuntimeRawObservationsIfRequested,
  loadRuntimeObservationsIfRequested,
  loadScenarioCatalogIfRequested,
  loadScenarioObservationSourceConfigIfRequested,
  loadScenarioObservationsIfRequested,
  loadTelemetryExportIfRequested,
  loadTelemetryNormalizationProfileIfRequested,
  loadTelemetryObservationsIfRequested,
  loadTelemetryRawObservationsIfRequested,
  loadTelemetrySourceConfigIfRequested,
  loadTopologyModelIfRequested,
  parseTieTolerance,
  requireArchitectureConstraints,
  requireDomainModel,
  requireShadowRolloutBatchSpec,
  requireShadowRolloutRegistry,
  resolveSpecRelativePath,
} from "./command-helpers.js";
import { normalizeDocuments, registerArtifacts } from "./core/artifacts.js";
import type {
  CommandContext,
  CommandResponse,
  DomainDesignScoreResult,
  DomainDesignShadowRolloutBatchObservation,
  DomainDesignShadowRolloutBatchResult,
  DomainDesignShadowRolloutGateResult,
  DomainDesignShadowRolloutObservation,
  MarkdownReportResult,
  MeasurementGateResult,
  ReviewItem,
  ReviewResolution,
} from "./core/contracts.js";
import { extractGlossary, extractInvariants, extractRules } from "./core/document-extractors.js";
import {
  analyzeCochangePersistence,
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality,
  normalizeHistory,
  scoreEvolutionLocality,
} from "./core/history.js";
import { readDataFile } from "./core/io.js";
import { loadPolicyConfig } from "./core/policy.js";
import { evaluateGate, renderMarkdownReport } from "./core/report.js";
import { confidenceFromSignals, createResponse, mergeStatus, toProvenance } from "./core/response.js";
import { listReviewItems, resolveReviewItems } from "./core/review.js";
import { scaffoldArchitectureConstraints, scaffoldDomainModel } from "./core/scaffold.js";
import { computeArchitectureScores, computeDomainDesignScores } from "./core/scoring.js";
import {
  batchToGateObservations,
  evaluateShadowRolloutGate,
  inferShadowRolloutModelSource,
  loadShadowRolloutRegistry,
  registryToGateObservations,
  summarizeShadowRolloutBatchObservations,
} from "./core/shadow-rollout.js";
import { buildModelCodeLinks, buildTermTraceLinks } from "./core/trace.js";
import { DOMAIN_PACKS } from "./packs/index.js";

export type CommandHandler = (args: CommandArgs, context: CommandContext) => Promise<CommandResponse<unknown>>;

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

  async "history.mine_cochange"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    return createResponse({ commits });
  },

  async "history.score_evolution_locality"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const analysis = scoreEvolutionLocality(commits, model);
    const quality = evaluateEvolutionLocalityObservationQuality(commits, model);
    return createResponse(analysis, {
      confidence: quality.confidence,
      unknowns: quality.unknowns,
    });
  },

  async "history.analyze_persistence"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const result = analyzeCochangePersistence(commits, model);
    return createResponse(result.analysis, {
      confidence: result.confidence,
      unknowns: result.unknowns,
    });
  },

  async "history.compare_locality_models"(args, context) {
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args));
    const model = await requireDomainModel(args, context);
    const result = compareEvolutionLocalityModels(commits, model);
    return createResponse(result.comparison, {
      confidence: result.confidence,
      unknowns: result.unknowns,
    });
  },

  async "arch.load_topology"(args, context) {
    const constraints = await requireArchitectureConstraints(args, context);
    return createResponse(constraints);
  },

  async "constraints.scaffold"(args, context) {
    const repoRoot = getRootPath(args, context);
    const scaffold = await scaffoldArchitectureConstraints({ repoRoot });
    return createResponse(scaffold.result, {
      status: scaffold.unknowns.length > 0 ? "warning" : "ok",
      evidence: scaffold.evidence,
      confidence: scaffold.confidence,
      unknowns: scaffold.unknowns,
      diagnostics: scaffold.diagnostics,
      provenance: [toProvenance(repoRoot, "architecture_constraints_scaffold")],
    });
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
    const pilotPersistence = args["pilot-persistence"] === true;
    const rolloutCategory = typeof args["rollout-category"] === "string" ? args["rollout-category"] : undefined;
    if (rolloutCategory && !pilotPersistence) {
      throw new Error("`--rollout-category` requires `--pilot-persistence`");
    }
    if (domain === "architecture_design") {
      const constraints = await requireArchitectureConstraints(args, context);
      const [
        scenarioCatalog,
        scenarioObservations,
        scenarioObservationSourceConfig,
        topologyModel,
        boundaryMap,
        runtimeObservations,
        deliveryObservations,
        deliveryRawObservations,
        deliveryExport,
        deliveryNormalizationProfile,
        deliverySourceConfig,
        telemetryObservations,
        telemetryRawObservations,
        telemetryExport,
        telemetryNormalizationProfile,
        telemetrySourceConfig,
        patternRuntimeObservations,
        patternRuntimeRawObservations,
        patternRuntimeNormalizationProfile,
        complexityExport,
        complexitySourceConfig,
      ] = await Promise.all([
        loadScenarioCatalogIfRequested(args, context),
        loadScenarioObservationsIfRequested(args, context),
        loadScenarioObservationSourceConfigIfRequested(args, context),
        loadTopologyModelIfRequested(args, context),
        loadBoundaryMapIfRequested(args, context),
        loadRuntimeObservationsIfRequested(args, context),
        loadDeliveryObservationsIfRequested(args, context),
        loadDeliveryRawObservationsIfRequested(args, context),
        loadDeliveryExportIfRequested(args, context),
        loadDeliveryNormalizationProfileIfRequested(args, context),
        loadDeliverySourceConfigIfRequested(args, context),
        loadTelemetryObservationsIfRequested(args, context),
        loadTelemetryRawObservationsIfRequested(args, context),
        loadTelemetryExportIfRequested(args, context),
        loadTelemetryNormalizationProfileIfRequested(args, context),
        loadTelemetrySourceConfigIfRequested(args, context),
        loadPatternRuntimeObservationsIfRequested(args, context),
        loadPatternRuntimeRawObservationsIfRequested(args, context),
        loadPatternRuntimeNormalizationProfileIfRequested(args, context),
        loadComplexityExportIfRequested(args, context),
        loadComplexitySourceConfigIfRequested(args, context),
      ]);

      const usableTelemetryRaw = Boolean(telemetryRawObservations && telemetryNormalizationProfile);
      const usableDeliveryRaw = Boolean(deliveryRawObservations && deliveryNormalizationProfile);
      const scenarioObservationSource =
        !scenarioObservations && scenarioObservationSourceConfig
          ? await resolveScenarioObservationSourceConfig(scenarioObservationSourceConfig)
          : undefined;
      const telemetrySource =
        !telemetryObservations && !usableTelemetryRaw && !telemetryExport && telemetrySourceConfig
          ? await resolveTelemetrySourceConfig(telemetrySourceConfig)
          : undefined;
      const deliverySource =
        !deliveryObservations && !usableDeliveryRaw && !deliveryExport && deliverySourceConfig
          ? await resolveDeliverySourceConfig(deliverySourceConfig)
          : undefined;
      const complexitySource =
        !complexityExport && complexitySourceConfig
          ? await resolveComplexitySourceConfig(complexitySourceConfig)
          : undefined;

      const directInputProvenance = [
        { argName: "scenario-catalog", note: "scenario_catalog_file" },
        { argName: "scenario-observations", note: "scenario_observations_file" },
        { argName: "topology-model", note: "topology_model_file" },
        { argName: "boundary-map", note: "boundary_map_file" },
        { argName: "runtime-observations", note: "runtime_observations_file" },
        { argName: "delivery-observations", note: "delivery_observations_file" },
        { argName: "delivery-raw-observations", note: "delivery_raw_observations_file" },
        { argName: "delivery-export", note: "delivery_export_file" },
        { argName: "delivery-normalization-profile", note: "delivery_normalization_profile_file" },
        { argName: "telemetry-observations", note: "telemetry_observations_file" },
        { argName: "telemetry-raw-observations", note: "telemetry_raw_observations_file" },
        { argName: "telemetry-export", note: "telemetry_export_file" },
        { argName: "telemetry-normalization-profile", note: "telemetry_normalization_profile_file" },
        { argName: "pattern-runtime-observations", note: "pattern_runtime_observations_file" },
        { argName: "pattern-runtime-raw-observations", note: "pattern_runtime_raw_observations_file" },
        {
          argName: "pattern-runtime-normalization-profile",
          note: "pattern_runtime_normalization_profile_file",
        },
        { argName: "complexity-export", note: "complexity_export_file" },
      ].flatMap(({ argName, note }) => {
        const inputPath = args[argName];
        return typeof inputPath === "string"
          ? [toProvenance(new URL(inputPath, `file://${context.cwd}/`).pathname, note)]
          : [];
      });

      const additionalProvenance = [
        ...directInputProvenance,
        ...(scenarioObservationSource
          ? [
              toProvenance(scenarioObservationSource.configPath, "scenario_observation_source_config"),
              ...(scenarioObservationSource.resolvedPath
                ? [toProvenance(scenarioObservationSource.resolvedPath, "scenario_observation_source_file")]
                : []),
            ]
          : []),
        ...(telemetrySource
          ? [
              toProvenance(telemetrySource.configPath, "telemetry_source_config"),
              ...(telemetrySource.resolvedPath
                ? [toProvenance(telemetrySource.resolvedPath, "telemetry_source_file")]
                : []),
            ]
          : []),
        ...(deliverySource
          ? [
              toProvenance(deliverySource.configPath, "delivery_source_config"),
              ...(deliverySource.resolvedPath
                ? [toProvenance(deliverySource.resolvedPath, "delivery_source_file")]
                : []),
            ]
          : []),
        ...(complexitySource
          ? [
              toProvenance(complexitySource.configPath, "complexity_source_config"),
              ...(complexitySource.resolvedPath
                ? [toProvenance(complexitySource.resolvedPath, "complexity_source_file")]
                : []),
            ]
          : []),
      ];

      return computeArchitectureScores({
        repoPath: getRootPath(args, context),
        constraints,
        policyConfig,
        profileName: getProfile(args),
        ...(scenarioCatalog ? { scenarioCatalog } : {}),
        ...(scenarioObservations ? { scenarioObservations } : {}),
        ...(scenarioObservationSource ? { scenarioObservationSource } : {}),
        ...(topologyModel ? { topologyModel } : {}),
        ...(boundaryMap ? { boundaryMap } : {}),
        ...(runtimeObservations ? { runtimeObservations } : {}),
        ...(deliveryObservations ? { deliveryObservations } : {}),
        ...(deliveryRawObservations ? { deliveryRawObservations } : {}),
        ...(deliveryExport ? { deliveryExport } : {}),
        ...(deliverySource ? { deliverySource } : {}),
        ...(deliveryNormalizationProfile ? { deliveryNormalizationProfile } : {}),
        ...(telemetryObservations ? { telemetryObservations } : {}),
        ...(telemetryRawObservations ? { telemetryRawObservations } : {}),
        ...(telemetryExport ? { telemetryExport } : {}),
        ...(telemetrySource ? { telemetrySource } : {}),
        ...(telemetryNormalizationProfile ? { telemetryNormalizationProfile } : {}),
        ...(patternRuntimeObservations ? { patternRuntimeObservations } : {}),
        ...(patternRuntimeRawObservations ? { patternRuntimeRawObservations } : {}),
        ...(patternRuntimeNormalizationProfile ? { patternRuntimeNormalizationProfile } : {}),
        ...(complexityExport ? { complexityExport } : {}),
        ...(complexitySource ? { complexitySource } : {}),
        additionalProvenance,
        scenarioObservationSourceRequested: Boolean(scenarioObservationSourceConfig),
        telemetrySourceRequested: Boolean(telemetrySourceConfig),
        deliverySourceRequested: Boolean(deliverySourceConfig),
        complexitySourceRequested: Boolean(complexitySourceConfig),
        patternRuntimeRawRequested: Boolean(patternRuntimeRawObservations),
        patternRuntimeNormalizationProfileRequested: Boolean(patternRuntimeNormalizationProfile),
      });
    }
    const model = await requireDomainModel(args, context);
    const docsRoot = typeof args["docs-root"] === "string" ? getDocsRoot(args, context) : undefined;
    const extractionOptions = docsRoot ? await buildExtractionOptions(args, context) : undefined;
    let pilotGateEvaluation: ReturnType<typeof evaluateShadowRolloutGate> | undefined;
    if (pilotPersistence) {
      if (!rolloutCategory) {
        throw new Error("`--rollout-category` is required when `--pilot-persistence` is enabled");
      }
      const { registry, registryPath } = await requireShadowRolloutRegistry(args, context, loadShadowRolloutRegistry);
      pilotGateEvaluation = evaluateShadowRolloutGate(registryToGateObservations(registry, registryPath));
    }

    return computeDomainDesignScores({
      repoPath: getRootPath(args, context),
      model,
      policyConfig,
      profileName: getProfile(args),
      shadowPersistence: args["shadow-persistence"] === true || pilotPersistence,
      ...(pilotPersistence && rolloutCategory ? { pilotPersistenceCategory: rolloutCategory } : {}),
      ...(pilotGateEvaluation ? { pilotGateEvaluation } : {}),
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
              applyReviewLog: extractionOptions.applyReviewLog,
            },
          }
        : {}),
    });
  },

  async "score.observe_shadow_rollout"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }

    const {
      "pilot-persistence": _pilotPersistence,
      "rollout-category": _rolloutCategory,
      "shadow-rollout-registry": _shadowRolloutRegistry,
      registry: _registry,
      ...shadowArgs
    } = args;

    const scoreResponse = (await scoreCompute(
      {
        ...shadowArgs,
        domain: "domain_design",
        "shadow-persistence": true,
      },
      context,
    )) as CommandResponse<DomainDesignScoreResult>;

    const elsMetric = scoreResponse.result.metrics.find((metric) => metric.metricId === "ELS");
    if (!elsMetric) {
      throw new Error("ELS metric is not available in the current domain score response");
    }
    if (!scoreResponse.result.shadow) {
      throw new Error("Shadow persistence payload is not available in the current domain score response");
    }

    const tieTolerance = typeof args["tie-tolerance"] === "string" ? Number.parseFloat(args["tie-tolerance"]) : 0.02;
    const safeTieTolerance = Number.isFinite(tieTolerance) && tieTolerance >= 0 ? tieTolerance : 0.02;
    const baselineElsValue = scoreResponse.result.pilot?.baselineElsValue ?? elsMetric.value;
    const policyDelta =
      scoreResponse.result.shadow.localityModels.persistenceCandidate.localityScore - baselineElsValue;
    const driftCategory =
      Math.abs(policyDelta) <= safeTieTolerance ? "aligned" : policyDelta > 0 ? "candidate_higher" : "candidate_lower";

    return createResponse<DomainDesignShadowRolloutObservation>(
      {
        domainId: "domain_design",
        metricId: "ELS",
        elsMetric,
        shadow: scoreResponse.result.shadow,
        observation: {
          policyDelta,
          modelDelta: scoreResponse.result.shadow.localityModels.delta,
          driftCategory,
          tieTolerance: safeTieTolerance,
        },
        history: scoreResponse.result.history,
        crossContextReferences: scoreResponse.result.crossContextReferences,
      },
      {
        status: scoreResponse.status,
        evidence: scoreResponse.evidence,
        confidence: scoreResponse.confidence,
        unknowns: scoreResponse.unknowns,
        diagnostics: scoreResponse.diagnostics,
        provenance: scoreResponse.provenance,
      },
    );
  },

  async "score.observe_shadow_rollout_batch"(args, context) {
    const observeShadowRollout = COMMANDS["score.observe_shadow_rollout"];
    if (!observeShadowRollout) {
      throw new Error("score.observe_shadow_rollout is not registered");
    }

    const { spec, specPath } = await requireShadowRolloutBatchSpec(args, context);
    const specDirectory = path.dirname(specPath);
    const argPolicyPath =
      typeof args.policy === "string" ? new URL(args.policy, `file://${context.cwd}/`).pathname : undefined;
    const argTieTolerance = parseTieTolerance(
      typeof args["tie-tolerance"] === "string" ? args["tie-tolerance"] : undefined,
    );

    const observations: DomainDesignShadowRolloutBatchObservation[] = [];
    const statuses = new Set<CommandResponse<unknown>["status"]>();
    const unknowns = new Set<string>();
    const diagnostics = new Set<string>();
    const confidenceSignals: number[] = [];

    for (const entry of spec.entries) {
      const repoPath = resolveSpecRelativePath(specDirectory, entry.repo);
      const modelPath = resolveSpecRelativePath(specDirectory, entry.model);
      const resolvedPolicyInput = entry.policy
        ? resolveSpecRelativePath(specDirectory, entry.policy)
        : spec.policy
          ? resolveSpecRelativePath(specDirectory, spec.policy)
          : argPolicyPath;

      if (!resolvedPolicyInput) {
        throw new Error(`Shadow rollout batch entry \`${entry.repoId}\` is missing a policy path`);
      }

      const tieTolerance =
        parseTieTolerance(entry.tieTolerance) ?? parseTieTolerance(spec.tieTolerance) ?? argTieTolerance;

      const response = (await observeShadowRollout(
        {
          repo: repoPath,
          model: modelPath,
          policy: resolvedPolicyInput,
          ...(tieTolerance !== undefined ? { "tie-tolerance": String(tieTolerance) } : {}),
        },
        context,
      )) as CommandResponse<DomainDesignShadowRolloutObservation>;

      const category = entry.category ?? "uncategorized";
      statuses.add(response.status);
      confidenceSignals.push(response.confidence);
      response.unknowns.forEach((unknown) => {
        unknowns.add(`${entry.repoId}: ${unknown}`);
      });
      response.diagnostics.forEach((diagnostic) => {
        diagnostics.add(`${entry.repoId}: ${diagnostic}`);
      });

      observations.push({
        repoId: entry.repoId,
        ...(entry.label ? { label: entry.label } : {}),
        category,
        modelSource: entry.modelSource ?? inferShadowRolloutModelSource(modelPath),
        repoPath,
        modelPath,
        policyPath: resolvedPolicyInput,
        status: response.status,
        elsMetric: response.result.elsMetric.value,
        persistenceLocalityScore: response.result.shadow.localityModels.persistenceCandidate.localityScore,
        policyDelta: response.result.observation.policyDelta,
        modelDelta: response.result.observation.modelDelta,
        driftCategory: response.result.observation.driftCategory,
        relevantCommitCount: response.result.shadow.localityModels.persistenceAnalysis.relevantCommitCount,
        confidence: response.confidence,
        unknowns: response.unknowns,
      });
    }

    const categories = Array.from(
      observations
        .reduce((groups, observation) => {
          const existing = groups.get(observation.category) ?? [];
          existing.push(observation);
          groups.set(observation.category, existing);
          return groups;
        }, new Map<string, DomainDesignShadowRolloutBatchObservation[]>())
        .entries(),
    ).map(([category, categoryObservations]) => ({
      category,
      repoIds: categoryObservations.map((entry) => entry.repoId),
      summary: summarizeShadowRolloutBatchObservations(categoryObservations),
    }));

    return createResponse<DomainDesignShadowRolloutBatchResult>(
      {
        observations,
        categories,
        overall: summarizeShadowRolloutBatchObservations(observations),
      },
      {
        status: mergeStatus(...statuses),
        confidence: confidenceFromSignals(confidenceSignals),
        unknowns: Array.from(unknowns),
        diagnostics: Array.from(diagnostics),
        provenance: [toProvenance(specPath, "shadow rollout batch spec")],
      },
    );
  },

  async "gate.evaluate_shadow_rollout"(args, context) {
    const observeShadowRolloutBatch = COMMANDS["score.observe_shadow_rollout_batch"];
    if (!observeShadowRolloutBatch) {
      throw new Error("score.observe_shadow_rollout_batch is not registered");
    }

    if (typeof args["batch-spec"] === "string") {
      const response = (await observeShadowRolloutBatch(
        args,
        context,
      )) as CommandResponse<DomainDesignShadowRolloutBatchResult>;
      const evaluation = evaluateShadowRolloutGate(batchToGateObservations(response.result.observations));

      return createResponse<DomainDesignShadowRolloutGateResult>(
        {
          source: "batch_spec",
          batchSpecPath: new URL(args["batch-spec"], `file://${context.cwd}/`).pathname,
          evaluation,
        },
        {
          status: evaluation.rolloutDisposition === "replace" ? response.status : "warning",
          evidence: response.evidence,
          confidence: response.confidence,
          unknowns: response.unknowns,
          diagnostics: response.diagnostics,
          provenance: response.provenance,
        },
      );
    }

    const { registry, registryPath } = await requireShadowRolloutRegistry(args, context, loadShadowRolloutRegistry);
    const evaluation = evaluateShadowRolloutGate(registryToGateObservations(registry, registryPath));

    return createResponse<DomainDesignShadowRolloutGateResult>(
      {
        source: "registry",
        registryPath,
        evaluation,
      },
      {
        status: evaluation.rolloutDisposition === "replace" ? "ok" : "warning",
        provenance: [toProvenance(registryPath, "shadow rollout registry")],
      },
    );
  },

  async "review.list_unknowns"(args, context) {
    const inputPath =
      typeof args.input === "string" ? new URL(args.input, `file://${context.cwd}/`).pathname : undefined;
    const sourceCommand = typeof args["source-command"] === "string" ? COMMANDS[args["source-command"]] : undefined;
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = inputPath
      ? await readDataFile<CommandResponse<unknown>>(inputPath)
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
        provenance: response.provenance,
      },
    );
  },

  async "review.resolve"(args, context) {
    const reviewItemsPath =
      typeof args["review-items"] === "string"
        ? new URL(args["review-items"], `file://${context.cwd}/`).pathname
        : undefined;
    const resolutionsPath =
      typeof args.resolutions === "string" ? new URL(args.resolutions, `file://${context.cwd}/`).pathname : undefined;
    if (!reviewItemsPath || !resolutionsPath) {
      throw new Error("`--review-items` and `--resolutions` are required");
    }
    const reviewItemsPayload = await readDataFile<{
      reviewItems?: ReviewItem[];
      result?: { reviewItems?: ReviewItem[] };
    }>(reviewItemsPath);
    const reviewItems = reviewItemsPayload.reviewItems ?? reviewItemsPayload.result?.reviewItems ?? [];
    const resolutions = await readDataFile<ReviewResolution[]>(resolutionsPath);
    const resolutionLog = resolveReviewItems(reviewItems, resolutions);
    return createResponse(resolutionLog, {
      status: resolutionLog.overrides.length > 0 ? "warning" : "ok",
      confidence: 0.9,
      provenance: [toProvenance(reviewItemsPath, "review.resolve"), toProvenance(resolutionsPath, "review.resolve")],
    });
  },

  async "report.generate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = (await scoreCompute(args, context)) as CommandResponse<
      | DomainDesignScoreResult
      | {
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
        }
    >;
    const format = typeof args.format === "string" ? args.format : "json";
    if (format === "md") {
      const profileName = getProfile(args);
      return createResponse<MarkdownReportResult>(
        {
          format,
          report: renderMarkdownReport(response, profileName),
        },
        {
          status: response.status,
          evidence: response.evidence,
          confidence: response.confidence,
          unknowns: response.unknowns,
          diagnostics: response.diagnostics,
          provenance: response.provenance,
        },
      );
    }
    return response;
  },

  async "gate.evaluate"(args, context) {
    const scoreCompute = COMMANDS["score.compute"];
    if (!scoreCompute) {
      throw new Error("score.compute is not registered");
    }
    const response = (await scoreCompute(args, context)) as CommandResponse<
      | DomainDesignScoreResult
      | {
          domainId: string;
          metrics: Array<{
            metricId: string;
            value: number;
            components: Record<string, number>;
            confidence: number;
            evidenceRefs: string[];
            unknowns: string[];
          }>;
        }
    >;
    const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
    const gate = evaluateGate(response, policyConfig, getProfile(args));
    const pilot =
      response.result.domainId === "domain_design" && "pilot" in response.result ? response.result.pilot : undefined;
    return createResponse<MeasurementGateResult>(
      {
        domainId: response.result.domainId as "domain_design" | "architecture_design",
        gate,
        metrics: response.result.metrics,
        ...(pilot ? { pilot } : {}),
      },
      {
        status: gate.status,
        evidence: response.evidence,
        confidence: response.confidence,
        unknowns: response.unknowns,
        diagnostics: [
          ...response.diagnostics,
          ...(pilot ? [`Pilot locality source: ${pilot.localitySource} for category ${pilot.category}.`] : []),
          `Available packs: ${DOMAIN_PACKS.map((pack) => pack.id).join(", ")}`,
        ],
      },
    );
  },
};

export function listCommands(): string[] {
  return Object.keys(COMMANDS).sort();
}

export async function maybeWriteOutput(
  response: CommandResponse<unknown>,
  args: Record<string, string | boolean>,
  context: CommandContext,
): Promise<void> {
  const output = typeof args.output === "string" ? new URL(args.output, `file://${context.cwd}/`).pathname : undefined;
  if (!output) {
    return;
  }
  await fs.writeFile(output, JSON.stringify(response, null, 2), "utf8");
}
