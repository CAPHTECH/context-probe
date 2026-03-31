export interface PortalRuntime {
  id: string;
}

export function createPortalRuntime(): PortalRuntime {
  return { id: "portal-runtime" };
}
