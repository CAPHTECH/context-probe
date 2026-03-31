export interface RuntimeGateway {
  endpoint: string;
}

export function createRuntimeGateway(): RuntimeGateway {
  return { endpoint: "runtime-gateway" };
}
