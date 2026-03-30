import { getProfile, getRootPath, requireDomainModel } from "./command-helpers.js";
import type { CommandHandler } from "./command-types.js";
import {
  analyzeCochangePersistence,
  compareEvolutionLocalityModels,
  evaluateEvolutionLocalityObservationQuality,
  normalizeHistory,
  scoreEvolutionLocality,
} from "./core/history.js";
import { loadPolicyConfig } from "./core/policy.js";
import { createResponse, toProvenance } from "./core/response.js";

export function createHistoryCommands(): Record<string, CommandHandler> {
  return {
    async "ingest.normalize_history"(args, context) {
      const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
      const model = typeof args.model === "string" ? await requireDomainModel(args, context) : undefined;
      const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args), {
        ...(model ? { includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs) } : {}),
      });
      return createResponse({ commits }, { provenance: [toProvenance(context.cwd, "history_registry")] });
    },

    async "history.mine_cochange"(args, context) {
      const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
      const model = typeof args.model === "string" ? await requireDomainModel(args, context) : undefined;
      const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args), {
        ...(model ? { includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs) } : {}),
      });
      return createResponse({ commits });
    },

    async "history.score_evolution_locality"(args, context) {
      const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
      const model = await requireDomainModel(args, context);
      const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args), {
        includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs),
      });
      const analysis = scoreEvolutionLocality(commits, model);
      const quality = evaluateEvolutionLocalityObservationQuality(commits, model);
      return createResponse(analysis, {
        confidence: quality.confidence,
        unknowns: quality.unknowns,
      });
    },

    async "history.analyze_persistence"(args, context) {
      const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
      const model = await requireDomainModel(args, context);
      const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args), {
        includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs),
      });
      const result = analyzeCochangePersistence(commits, model);
      return createResponse(result.analysis, {
        confidence: result.confidence,
        unknowns: result.unknowns,
      });
    },

    async "history.compare_locality_models"(args, context) {
      const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
      const model = await requireDomainModel(args, context);
      const commits = await normalizeHistory(getRootPath(args, context), policyConfig, getProfile(args), {
        includePathGlobs: model.contexts.flatMap((entry) => entry.pathGlobs),
      });
      const result = compareEvolutionLocalityModels(commits, model);
      return createResponse(result.comparison, {
        confidence: result.confidence,
        unknowns: result.unknowns,
      });
    },
  };
}
