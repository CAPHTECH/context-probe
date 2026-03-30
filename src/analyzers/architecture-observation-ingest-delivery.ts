import type { ArchitectureDeliveryExportBundle, ArchitectureDeliveryRawObservationSet } from "../core/contracts.js";
import { average, clamp01, type ObservationIngestFinding, unique } from "./architecture-observation-ingest-shared.js";

export interface IngestedDeliveryExport {
  deliveryRawObservations: ArchitectureDeliveryRawObservationSet;
  confidence: number;
  unknowns: string[];
  findings: ObservationIngestFinding[];
}

export function ingestDeliveryExportBundle(bundle: ArchitectureDeliveryExportBundle): IngestedDeliveryExport {
  const findings: ObservationIngestFinding[] = [];
  const unknowns: string[] = [];
  const confidenceSignals: number[] = [];
  const measurements = bundle.measurements;

  const mappings = [
    { component: "leadTime", scoreComponent: "LeadTime" as const, observed: measurements.leadTime },
    {
      component: "deployFrequency",
      scoreComponent: "DeployFrequency" as const,
      observed: measurements.deployFrequency,
    },
    { component: "recoveryTime", scoreComponent: "RecoveryTime" as const, observed: measurements.recoveryTime },
    {
      component: "changeFailRate",
      scoreComponent: "ChangeFailRate" as const,
      observed: measurements.changeFailRate,
    },
    { component: "reworkRate", scoreComponent: "ReworkRate" as const, observed: measurements.reworkRate },
  ] as const;

  for (const mapping of mappings) {
    if (mapping.observed === undefined) {
      unknowns.push(`The delivery export is missing ${mapping.component}.`);
      findings.push({
        kind: "delivery_export_missing_signal",
        confidence: 0.62,
        note: `The delivery export is missing ${mapping.component}.`,
        component: mapping.component,
        ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {}),
      });
      confidenceSignals.push(0.55);
      continue;
    }
    findings.push({
      kind: "delivery_export_signal_mapped",
      confidence: 0.84,
      note: `Imported ${mapping.component} from the delivery export into raw delivery input.`,
      component: mapping.component,
      observed: mapping.observed,
      ...(bundle.sourceSystem ? { sourceSystem: bundle.sourceSystem } : {}),
    });
    confidenceSignals.push(0.84);
  }

  return {
    deliveryRawObservations: {
      version: bundle.version,
      values: {
        ...(measurements.leadTime !== undefined ? { LeadTime: measurements.leadTime } : {}),
        ...(measurements.deployFrequency !== undefined ? { DeployFrequency: measurements.deployFrequency } : {}),
        ...(measurements.recoveryTime !== undefined ? { RecoveryTime: measurements.recoveryTime } : {}),
        ...(measurements.changeFailRate !== undefined ? { ChangeFailRate: measurements.changeFailRate } : {}),
        ...(measurements.reworkRate !== undefined ? { ReworkRate: measurements.reworkRate } : {}),
      },
      ...(bundle.sourceSystem ? { source: bundle.sourceSystem } : {}),
      ...(bundle.note ? { note: bundle.note } : {}),
    },
    confidence: clamp01(average(confidenceSignals, 0.6)),
    unknowns: unique(unknowns),
    findings,
  };
}
