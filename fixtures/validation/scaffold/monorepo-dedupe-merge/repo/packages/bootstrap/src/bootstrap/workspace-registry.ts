export interface WorkspaceRegistry {
  root: string;
}

export function createWorkspaceRegistry(): WorkspaceRegistry {
  return { root: "workspace" };
}
