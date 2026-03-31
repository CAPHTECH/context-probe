export interface PortalBootstrap {
  workspaceId: string;
}

export function createPortalBootstrap(): PortalBootstrap {
  return { workspaceId: "portal" };
}
