#!/usr/bin/env python3
"""Low-level path and filename helpers for context-probe input workflows."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path


def context_probe_dir(repo: Path, docs_root: str | None) -> Path:
    if docs_root:
        docs_path = (repo / docs_root).resolve() if not Path(docs_root).is_absolute() else Path(docs_root).resolve()
        return docs_path / "architecture" / "context-probe"
    return repo.resolve() / "docs" / "architecture" / "context-probe"


def command_layout(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    target_dir = context_probe_dir(repo, args.docs_root)
    payload = {
      "repo": str(repo),
      "contextProbeDir": str(target_dir),
      "files": {
        "readme": str(target_dir / "README.md"),
        "assessment": str(target_dir / f"assessment-{args.date}.md"),
        "domainModelScaffold": str(target_dir / "domain-model.scaffold.yaml"),
        "domainModel": str(target_dir / "domain-model.yaml"),
        "architectureConstraintsScaffold": str(target_dir / "architecture-constraints.scaffold.yaml"),
        "architectureConstraints": str(target_dir / "architecture-constraints.yaml"),
        "scenarioCatalogScaffold": str(target_dir / "architecture-scenario-catalog.scaffold.yaml"),
        "scenarioObservationsTemplate": str(target_dir / "architecture-scenario-observations.template.yaml"),
        "scenarioObservations": str(target_dir / "architecture-scenario-observations.yaml"),
        "topologyModelScaffold": str(target_dir / "architecture-topology-model.scaffold.yaml"),
        "boundaryMapScaffold": str(target_dir / "architecture-boundary-map.scaffold.yaml"),
        "runtimeObservations": str(target_dir / "architecture-runtime-observations.yaml"),
        "patternRuntimeObservations": str(target_dir / "architecture-pattern-runtime-observations.yaml"),
        "telemetryObservations": str(target_dir / "architecture-telemetry-observations.yaml"),
        "deliveryObservations": str(target_dir / "architecture-delivery-observations.yaml"),
        "contractBaseline": str(target_dir / "architecture-contract-baseline.yaml"),
      },
    }
    print(json.dumps(payload, indent=2))
    return 0


def command_assessment_name(args: argparse.Namespace) -> int:
    print(f"assessment-{args.date}.md")
    return 0


def command_worktree(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    parent = repo.parent
    worktrees_root = parent / f"{repo.name}.worktrees"
    worktree_path = worktrees_root / args.suffix
    branch = f"{args.branch_prefix.rstrip('/')}/{args.suffix}"
    payload = {
      "repo": str(repo),
      "worktreesRoot": str(worktrees_root),
      "worktreePath": str(worktree_path),
      "branch": branch,
    }
    print(json.dumps(payload, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Recommend paths for context-probe YAML workflows.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    layout = subparsers.add_parser("layout", help="Print recommended repo-local input file paths.")
    layout.add_argument("--repo", required=True, help="Target repository root.")
    layout.add_argument("--docs-root", help="Docs root relative to repo, defaults to docs.")
    layout.add_argument("--date", default=str(date.today()), help="Assessment date in YYYY-MM-DD format.")
    layout.set_defaults(func=command_layout)

    assessment = subparsers.add_parser("assessment-name", help="Print the default assessment filename.")
    assessment.add_argument("--date", default=str(date.today()), help="Assessment date in YYYY-MM-DD format.")
    assessment.set_defaults(func=command_assessment_name)

    worktree = subparsers.add_parser("worktree", help="Print the recommended dedicated worktree path and branch.")
    worktree.add_argument("--repo", required=True, help="Target repository root.")
    worktree.add_argument("--suffix", default="context-probe-inputs", help="Worktree folder suffix.")
    worktree.add_argument("--branch-prefix", default="codex", help="Branch prefix.")
    worktree.set_defaults(func=command_worktree)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
