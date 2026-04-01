import type { CommandArgs } from "./command-helpers.js";
import { getProfile } from "./command-helpers.js";
import type {
  ArchitectureScenarioQualitySummary,
  CommandContext,
  CommandResponse,
  DomainDesignScoreResult,
  LocalityWatchlistItem,
  MarkdownReportResult,
  MeasurementGateResult,
  MetricScore,
} from "./core/contracts.js";
import { readDataFile } from "./core/io.js";
import { mergeRuntimeSummary } from "./core/measurement-metadata.js";
import { loadPolicyConfig } from "./core/policy.js";
import { evaluateGate, renderMarkdownReport } from "./core/report.js";
import { createResponse } from "./core/response.js";
import { listReviewItems } from "./core/review.js";
import { DOMAIN_PACKS } from "./packs/index.js";

interface ArchitectureScoreResult {
  domainId: "architecture_design";
  metrics: MetricScore[];
  leakFindings?: unknown[];
  violations?: unknown[];
  scenarioQuality?: ArchitectureScenarioQualitySummary;
  localityWatchlist?: LocalityWatchlistItem[];
}

type ScorePayload = DomainDesignScoreResult | ArchitectureScoreResult;
type ScoreCommand = (args: CommandArgs, context: CommandContext) => Promise<CommandResponse<unknown>>;

export async function handleReviewListUnknowns(
  args: CommandArgs,
  context: CommandContext,
  scoreCompute: ScoreCommand,
  commandRegistry: Record<string, ScoreCommand>,
): Promise<CommandResponse<{ reviewItems: ReturnType<typeof listReviewItems> }>> {
  const startedAt = Date.now();
  const inputPath = typeof args.input === "string" ? new URL(args.input, `file://${context.cwd}/`).pathname : undefined;
  const sourceCommand =
    typeof args["source-command"] === "string" ? commandRegistry[args["source-command"]] : undefined;
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
      progress: response.progress,
      provenance: response.provenance,
      meta: {
        ...(response.meta ?? {}),
        runtime: mergeRuntimeSummary(response.meta?.runtime, {
          totalMs: (response.meta?.runtime?.totalMs ?? 0) + (Date.now() - startedAt),
          stages: { reviewMs: Date.now() - startedAt },
        }),
      },
    },
  );
}

export async function handleReportGenerate(
  args: CommandArgs,
  context: CommandContext,
  scoreCompute: ScoreCommand,
): Promise<CommandResponse<ScorePayload | MarkdownReportResult>> {
  const startedAt = Date.now();
  const response = (await scoreCompute(args, context)) as CommandResponse<ScorePayload>;
  const format = typeof args.format === "string" ? args.format : "json";
  if (format === "md") {
    const renderStartedAt = Date.now();
    const renderedReport = renderMarkdownReport(response, getProfile(args));
    const renderMs = Date.now() - renderStartedAt;
    return createResponse<MarkdownReportResult>(
      {
        format,
        report: renderedReport,
      },
      {
        status: response.status,
        evidence: response.evidence,
        confidence: response.confidence,
        unknowns: response.unknowns,
        diagnostics: response.diagnostics,
        progress: response.progress,
        provenance: response.provenance,
        meta: {
          ...(response.meta ?? {}),
          runtime: mergeRuntimeSummary(response.meta?.runtime, {
            totalMs: (response.meta?.runtime?.totalMs ?? 0) + (Date.now() - startedAt),
            stages: { renderMs },
          }),
        },
      },
    );
  }
  return response;
}

export async function handleGateEvaluate(
  args: CommandArgs,
  context: CommandContext,
  scoreCompute: ScoreCommand,
): Promise<CommandResponse<MeasurementGateResult>> {
  const startedAt = Date.now();
  const response = (await scoreCompute(args, context)) as CommandResponse<ScorePayload>;
  const policyConfig = await loadPolicyConfig(typeof args.policy === "string" ? args.policy : undefined);
  const gate = evaluateGate(response, policyConfig, getProfile(args));
  const pilot =
    response.result.domainId === "domain_design" && "pilot" in response.result ? response.result.pilot : undefined;
  return createResponse<MeasurementGateResult>(
    {
      domainId: response.result.domainId,
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
      progress: response.progress,
      meta: {
        ...(response.meta ?? {}),
        runtime: mergeRuntimeSummary(response.meta?.runtime, {
          totalMs: (response.meta?.runtime?.totalMs ?? 0) + (Date.now() - startedAt),
          stages: { gateMs: Date.now() - startedAt },
        }),
      },
    },
  );
}
