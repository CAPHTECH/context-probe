import type { CommandContext } from "./core/contracts.js";
import { toProvenance } from "./core/response.js";

const DIRECT_ARCHITECTURE_INPUTS = [
  { argName: "scenario-catalog", note: "scenario_catalog_file" },
  { argName: "scenario-observations", note: "scenario_observations_file" },
  { argName: "topology-model", note: "topology_model_file" },
  { argName: "boundary-map", note: "boundary_map_file" },
  { argName: "contract-baseline", note: "contract_baseline_file" },
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
  { argName: "pattern-runtime-normalization-profile", note: "pattern_runtime_normalization_profile_file" },
  { argName: "complexity-export", note: "complexity_export_file" },
] as const;

export function collectDirectInputProvenance(args: Record<string, string | boolean>, context: CommandContext) {
  return DIRECT_ARCHITECTURE_INPUTS.flatMap(({ argName, note }) => {
    const inputPath = args[argName];
    return typeof inputPath === "string"
      ? [toProvenance(new URL(inputPath, `file://${context.cwd}/`).pathname, note)]
      : [];
  });
}
