import path from "node:path";

import type {
  ArchitectureConstraints,
  CodebaseAnalysis,
  LayerDefinition,
  ParsedSourceFile,
} from "../core/contracts.js";
import { matchGlobs } from "../core/io.js";

const CONTRACT_DIRECTORY_SIGNAL = /(^|\/)(contracts?|dtos?|schemas?|protocols?|interfaces?|apis?)(\/|$)/i;
const CONTRACT_BASENAME_SIGNAL = /(?:^|[_-])(contract|dto|event|schema|protocol|interface|api)s?\.[^.]+$/i;
const CONTRACT_LAYER_NAME_SIGNAL = /\b(contracts?|dtos?|schemas?|protocols?|interfaces?|apis?)\b/i;
const DART_DOMAIN_LAYER_SIGNAL = /\bdomain\b/i;

export function classifyArchitectureLayer(
  filePath: string,
  constraints: ArchitectureConstraints,
): LayerDefinition | undefined {
  return constraints.layers.find((layer) => matchGlobs(filePath, layer.globs));
}

function hasContractDirectorySignal(filePath: string): boolean {
  return CONTRACT_DIRECTORY_SIGNAL.test(filePath);
}

function hasContractBasenameSignal(filePath: string): boolean {
  return CONTRACT_BASENAME_SIGNAL.test(path.basename(filePath));
}

function isContractLayer(layer: LayerDefinition): boolean {
  return CONTRACT_LAYER_NAME_SIGNAL.test(layer.name) || layer.globs.some((glob) => hasContractDirectorySignal(glob));
}

function hasExplicitContractLayer(constraints: ArchitectureConstraints): boolean {
  return constraints.layers.some((layer) => isContractLayer(layer));
}

function isDartDomainFallbackContract(options: {
  parsedFile: ParsedSourceFile | undefined;
  layer: LayerDefinition | undefined;
  allowDartDomainFallback: boolean;
  explicitContractLayerExists: boolean;
}): boolean {
  if (!options.allowDartDomainFallback || options.explicitContractLayerExists) {
    return false;
  }
  if (options.parsedFile?.language !== "dart") {
    return false;
  }
  return Boolean(options.layer && DART_DOMAIN_LAYER_SIGNAL.test(options.layer.name));
}

export function collectContractFilePaths(options: {
  codebase: CodebaseAnalysis;
  constraints: ArchitectureConstraints;
  allowDartDomainFallback?: boolean;
}): string[] {
  const explicitContractLayerExists = hasExplicitContractLayer(options.constraints);
  const fileMap = new Map(options.codebase.files.map((file) => [file.path, file]));

  return options.codebase.scorableSourceFiles.filter((filePath) => {
    const parsedFile = fileMap.get(filePath);
    const layer = classifyArchitectureLayer(filePath, options.constraints);

    if (hasContractDirectorySignal(filePath) || hasContractBasenameSignal(filePath)) {
      return true;
    }
    if (layer && isContractLayer(layer)) {
      return true;
    }
    return isDartDomainFallbackContract({
      parsedFile,
      layer,
      allowDartDomainFallback: options.allowDartDomainFallback ?? false,
      explicitContractLayerExists,
    });
  });
}
