import type { LayerDefinition } from "../core/contracts.js";

const FRAMEWORK_SIGNAL =
  /(infrastructure|infra|adapter|adapters|framework|frameworks|controller|controllers|gateway|gateways|schema|logger|http|web|ui)/i;
const INTERNAL_SIGNAL = /(internal|infra|infrastructure|adapter|adapters|schema|logger|gateway|gateways)/i;
const SHARED_FRAMEWORK_LAYER_SIGNAL = /(shared|common|platform|core|foundation|theme|ui)/i;

export function isFrameworkish(filePath: string, layerName?: string): boolean {
  return FRAMEWORK_SIGNAL.test(filePath) || (layerName ? FRAMEWORK_SIGNAL.test(layerName) : false);
}

export function isInternalish(filePath: string, layerName?: string): boolean {
  return INTERNAL_SIGNAL.test(filePath) || (layerName ? INTERNAL_SIGNAL.test(layerName) : false);
}

export function isAllowedFrameworkLayer(layer: LayerDefinition, maxRank: number): boolean {
  return layer.rank === maxRank || isFrameworkish(layer.name) || SHARED_FRAMEWORK_LAYER_SIGNAL.test(layer.name);
}

export function average(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
