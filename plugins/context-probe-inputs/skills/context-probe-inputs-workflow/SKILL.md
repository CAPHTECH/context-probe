---
name: context-probe-inputs-workflow
description: `context-probe` を既存 repo に適用するための YAML 入力整備ワークフロー。`context-probe input を作って` `repo に context-probe を適用して` `scaffold から curated YAML にして` と言われた時に使う。
---

# Context Probe Inputs Workflow

`context-probe` の repo 適用を、scaffold から curated YAML、観測入力、assessment まで段階的に進める。

## 用語

- `scaffold`: CLI が返す下書き。レビューしてから使う。
- `curated input`: 対象 repo に残して保守する YAML。
- `starter run`: 方向と不足入力を確認する最初の計測。
- `authoritative run`: curated input と観測入力をそろえた本命の計測。
- `observation snapshot`: scenario/runtime/telemetry/delivery などの観測結果ファイル。

## ガードレール

- 観測値を創作しない。
- `scenarioObservationsTemplate` は記入テンプレートとして扱う。
- `contract-baseline` を無条件で更新しない。
- unknown を消すためだけに YAML を改変しない。
- 対象 repo を直接編集せず、まず専用 worktree を提案する。
- 変更は段階ごとに説明し、次へ進む前にユーザー確認を取る。

## Workflow

### Step 1. 対象 repo の現状を確認する

- repo の `docs`、既存 `context-probe` 入力、dirty worktree の有無を確認する。
- 既存入力がある場合は「新規作成」ではなく「更新」フローとして扱う。
- 保存先候補や worktree 候補は `../../scripts/context_probe_inputs_paths.py` を使って提案する。

### Step 2. 専用 worktree を提案する

- 対象 repo に書き込む前に、専用 worktree を標準案として提示する。
- 少なくとも次を説明する。
  - 元 repo を汚さない
  - `context-probe` 用入力だけを隔離できる
  - commit 単位が整理しやすい
- ユーザーが拒否しない限り、worktree 前提で進める。

### Step 3. scaffold を実行する

- まず `model.scaffold` と `constraints.scaffold` を使う。
- `docs-root` がある repo では `model.scaffold --docs-root` を優先する。
- 出力はそのまま使わず、保存前に「下書き」であることを明示する。

### Step 4. scaffold の保存先を提案する

- 保存先は原則 `docs/architecture/context-probe/` 配下にそろえる。
- 最初に提案するファイルは次。
  - `domain-model.scaffold.yaml`
  - `architecture-constraints.scaffold.yaml`
  - `architecture-scenario-catalog.scaffold.yaml`
  - `architecture-topology-model.scaffold.yaml`
  - `architecture-boundary-map.scaffold.yaml`
  - `architecture-scenario-observations.template.yaml`
  - `README.md`
  - `assessment-YYYY-MM-DD.md`
- パスや assessment 名は `../../scripts/context_probe_inputs_paths.py` を使って生成する。

### Step 5. curated YAML 化を支援する

- `domain-model.yaml` では次を支援する。
  - noisy candidate の除去
  - context 名の調整
  - explicit aggregate の追加
- `architecture-constraints.yaml` では次を支援する。
  - broad layer の整理
  - allowed edge の調整
  - repo で意味のない starter layer の除去
- 編集は一気に確定せず、変更理由を短く説明して確認を取る。

### Step 6. 観測入力を扱い分ける

- `scenarioObservationsTemplate` は「埋めるための確認表」として扱う。
- 自動で作ってよいのは次まで。
  - 空の observation ファイル
  - 観測項目の見出し
  - assessment の雛形
- 自動で作ってはいけないのは次。
  - benchmark をしていない scenario 値
  - telemetry/delivery/runtime の事実値
  - baseline 比較の意味が壊れる contract-baseline の無条件更新

### Step 7. starter run を回す

- まず `domain_design` と `architecture_design` を 1 回ずつ回す。
- starter run の目的は次だけに絞る。
  - 方向を見る
  - 何が不足しているか知る
  - YAML が大きく外していないか確認する
- 結果説明では「もう使える指標」と「まだ proxy-heavy な指標」を分けて伝える。

### Step 8. 必要な観測だけ追加する

- `architecture_design` では、重要な指標にだけ対応する観測を追加する。
  - `scenario-observations` -> `QSF`
  - `contract-baseline` -> `IPS`
  - `runtime-observations` -> `TIS`
  - `pattern-runtime-observations` / `telemetry-observations` -> `OAS`
  - `delivery-observations` -> `EES`
- `domain_design` では、まず explicit aggregate、docs coverage、history の不足を優先する。

### Step 9. authoritative run を回す

- curated input と観測入力が揃ったら、本命の計測を回す。
- `domain_design` は full input のまま最後まで待つことを基本にする。
- `architecture_design` は bundle 入力を使い、starter run との差を説明する。

### Step 10. assessment を更新する

- assessment には最低限次を残す。
  - 日付
  - repo path または revision
  - 使った入力
  - 最終的な主要メトリクス
  - remaining unknown classes
  - 次の follow-up
- assessment は外向けレポートではなく、次回の比較基準として扱う。

## 目的別の操作単位

- `init repo inputs`
  - scaffold の保存と `README` / assessment 雛形の配置
- `promote domain model`
  - `domain-model.yaml` の作成・更新
- `promote architecture constraints`
  - `architecture-constraints.yaml` の作成・更新
- `prepare observations`
  - template から始める観測入力ファイルの準備
- `refresh assessment`
  - score 再実行後の要約更新

## 追加で使うコマンド

- 深掘りが必要なときだけ次を使う。
  - `review.list_unknowns`
  - `doc.extract_*`
  - `trace.*`
  - `history.*`
- 実装の契約が必要な場合だけ `docs/implementation/runtime-and-commands.md` を読む。
