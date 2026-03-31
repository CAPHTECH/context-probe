# Runtime Infrastructure context

## Glossary

- `RuntimeGateway` receives runtime requests in the Runtime Infrastructure context.
- `PortalRuntime` runs the portal runtime path in the Runtime Infrastructure context.

## Rules

- In the Runtime Infrastructure context, `RuntimeGateway` and `PortalRuntime` must remain synchronized.

# Workspace Bootstrap context

## Glossary

- `WorkspaceRegistry` coordinates bootstrap state in the Workspace Bootstrap context.
- `PortalBootstrap` prepares workspace state in the Workspace Bootstrap context.

## Rules

- In the Workspace Bootstrap context, `WorkspaceRegistry` and `PortalBootstrap` must remain synchronized.

# Evaluation Quality context

## Glossary

- `EvaluationReview` records evaluation outcomes in the Evaluation Quality context.
- `EvaluationBaseline` records comparison baselines in the Evaluation Quality context.

## Rules

- In the Evaluation Quality context, `EvaluationReview` and `EvaluationBaseline` must remain comparable.
