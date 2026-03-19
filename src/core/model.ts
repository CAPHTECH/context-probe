import type { ArchitectureConstraints, DomainModel } from "./contracts.js";
import { readDataFile } from "./io.js";

export async function loadDomainModel(modelPath: string): Promise<DomainModel> {
  const model = await readDataFile<DomainModel>(modelPath);
  if (!Array.isArray(model.contexts) || model.contexts.length === 0) {
    throw new Error("Domain model must contain at least one context");
  }
  return model;
}

export async function loadArchitectureConstraints(
  constraintsPath: string
): Promise<ArchitectureConstraints> {
  const constraints = await readDataFile<ArchitectureConstraints>(constraintsPath);
  if (!Array.isArray(constraints.layers) || constraints.layers.length === 0) {
    throw new Error("Architecture constraints must contain at least one layer");
  }
  return constraints;
}
