import type { ArchitectureConstraints, DomainModel } from "./contracts.js";
import { readDataFile } from "./io.js";

export async function loadDomainModel(modelPath: string): Promise<DomainModel> {
  const model = await readDataFile<DomainModel>(modelPath);
  if (!Array.isArray(model.contexts) || model.contexts.length === 0) {
    throw new Error("Domain model must contain at least one context");
  }
  if (model.aggregates !== undefined) {
    if (!Array.isArray(model.aggregates)) {
      throw new Error("Domain model aggregates must be an array when provided");
    }
    const contextNames = new Set(model.contexts.map((context) => context.name));
    for (const aggregate of model.aggregates) {
      if (typeof aggregate.name !== "string" || aggregate.name.trim().length === 0) {
        throw new Error("Domain model aggregates must declare a non-empty name");
      }
      if (typeof aggregate.context !== "string" || !contextNames.has(aggregate.context)) {
        throw new Error(`Aggregate "${aggregate.name}" must reference an existing context`);
      }
      if (
        aggregate.aliases !== undefined &&
        (!Array.isArray(aggregate.aliases) || aggregate.aliases.some((alias) => typeof alias !== "string"))
      ) {
        throw new Error(`Aggregate "${aggregate.name}" aliases must be an array of strings`);
      }
    }
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
