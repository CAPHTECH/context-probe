# 実行パイプラインとコマンド体系

## 1. 目的

この文書は、AIによる抽出と決定的解析をどう分離し、どのようなコマンド体系で実行するかを定義する。

- 指標の意味は `reference/` を読む
- ドメイン別の current implementation は [domain-design-measurement.ja.md](domain-design-measurement.ja.md) と [architecture-design-measurement.ja.md](architecture-design-measurement.ja.md) を読む

## 2. 実行パイプライン

```text
ingest -> normalize -> extract -> trace -> analyze -> score -> review -> report
```

### 2.1 ingest

- 文書、コード、履歴、Issue、運用情報を収集する
- 入力ソースと取得時刻を provenance に残す

### 2.2 normalize

- 文書断片、コードシンボル、コミット、Issue、図要素に安定IDを付与する

### 2.3 extract

- AIが用語、ルール、候補境界、曖昧性、候補トポロジを抽出する

### 2.4 trace

- 文書、モデル、コード、履歴の追跡リンクを生成する

### 2.5 analyze

- 依存解析、境界違反検出、契約利用検証、履歴解析などの決定的処理を行う
- JS / TS は AST ベースで import / export を抽出する
- Dart は軽量 scanner で `import` `export` `part` を抽出する
- Dart の `package:` URI は root の `pubspec.yaml` と同名 package のみ `lib/` 配下へ解決し、他 package と `dart:` は external 扱いにする
- Dart の `part of` と `*.g.dart` などの生成ファイルは raw 解析には残すが、trace / score では scorable source から除外する

### 2.6 score

- 指標式、重み、閾値を設定ファイルから読み取り算出する

### 2.7 review

- 低 confidence、unknowns、多義性を `Review Queue` に送る

### 2.8 report

- 現状レポート、候補比較、差分、時系列、PRゲート結果を生成する

## 3. コマンド設計原則

1. AI処理と決定的解析を分ける
2. コマンドは単機能で再実行しやすくする
3. すべての結果に証拠と provenance を返す
4. 差分実行とフル実行の両方をサポートする
5. 評価領域追加時は、新しい名前空間を足すだけで済むようにする

## 4. 共通コマンド

| コマンド | 目的 | 主な出力 |
|---|---|---|
| `ingest.register_artifacts` | 入力ソースを登録する | Artifact Registry |
| `ingest.normalize_documents` | 文書断片化とID付与を行う | Document Fragments |
| `ingest.normalize_history` | Git / PR / Issueを正規化する | History Registry |
| `doc.extract_glossary` | 用語候補を抽出する | Glossary Graph |
| `doc.extract_rules` | 業務ルールを抽出する | Rule Catalog |
| `doc.extract_invariants` | 不変条件を抽出する | Invariant Catalog |
| `trace.link_terms` | 用語追跡リンクを作る | Traceability Graph |
| `trace.link_model_to_code` | モデルとコードを紐づける | Model-Code Links |
| `history.analyze_persistence` | co-change の持続構造を調べる | Experimental History Topology |
| `history.compare_locality_models` | `ELS` と beta0 persistence 候補を比較する | Experimental Locality Comparison |
| `score.observe_shadow_rollout` | 1 repo の shadow 差分を観測する | Shadow Rollout Observation |
| `score.observe_shadow_rollout_batch` | 複数 repo の shadow 差分を集計する | Shadow Rollout Batch Report |
| `gate.evaluate_shadow_rollout` | beta0 persistence の採用 gate を評価する | Shadow Rollout Gate |
| `code.parse` | AST / シンボル情報や Dart directive graph を構築する | AST / Symbol Table |
| `code.detect_dependencies` | 静的依存を抽出する | Dependency Graph |
| `code.detect_contract_usage` | 契約経由性を検証する | Contract Usage Report |
| `history.mine_cochange` | co-change を抽出する | Co-change Graph |
| `score.compute` | スコアを計算する | Metric Scores |
| `review.list_unknowns` | 未確定事項を抽出する | Review Queue |
| `review.resolve` | レビュー結果を反映する | Review Resolution Log |
| `report.generate` | レポートを生成する | Measurement Report |
| `gate.evaluate` | 閾値判定を行う | Gate Result |

## 5. ドメイン設計パック用コマンド

| コマンド | 目的 |
|---|---|
| `model.load` | 明示モデルを読み込む |
| `model.scaffold` | Context / Aggregate 候補を含む domain model YAML を scaffold する |
| `code.detect_boundary_leaks` | 境界漏れを検出する |
| `graph.build_coupling` | 境界採点用の coupling graph を作る |
| `graph.score_decomposition` | 境界分割案を採点する |
| `model.score_aggregate_fitness` | Aggregate適合度を採点する |
| `history.score_evolution_locality` | 進化局所性を採点する |
| `history.analyze_persistence` | co-change の持続構造を調べる |
| `history.compare_locality_models` | `ELS` と beta0 persistence 候補を比較する |
| `score.observe_shadow_rollout` | 1 repo の shadow 差分を観測する |
| `score.observe_shadow_rollout_batch` | 複数 repo の shadow 差分を集計する |
| `gate.evaluate_shadow_rollout` | curated な観測値または live batch から採用 gate を評価する |

補足:

- `history.analyze_persistence` は experimental な inspection コマンドです
- `history.compare_locality_models` は採用判断や calibration のための experimental 比較コマンドです
- `score.observe_shadow_rollout` は `score.compute --shadow-persistence` を 1 repo 向けに読みやすくした wrapper です
- `score.observe_shadow_rollout_batch` は YAML / JSON の `--batch-spec` を読み、複数 repo の差分と category / overall 集計を返します
- `gate.evaluate_shadow_rollout` は YAML / JSON の `--registry` または `--batch-spec` を読み、現在の置換可否と `shadow_only` / `replace` 判定を返します
- `gate.evaluate_shadow_rollout` の category summary には category ごとの `shadow_only` / `replace` 判定も含まれます
- `score.compute` の `ELS` を置き換えるものではなく、補助診断として使います
- `score.compute --shadow-persistence` は beta0 persistence 比較を `result.shadow.localityModels` に追加するだけで、`ELS` の値や閾値は変えません
- `score.compute --pilot-persistence --rollout-category <category> --shadow-rollout-registry <path>` は category-gated な pilot です
- pilot は `result.shadow.localityModels` を必ず計算し、category gate が `replace` のときだけ `ELS` を persistence candidate に切り替えます
- pilot の適用結果は `result.pilot` に入り、baseline `ELS`、candidate 値、effective `ELS`、overall/category gate 状態を返します
- score-neutral であり、既存の policy 式や閾値を変更しません

## 6. アーキテクチャ設計パック用コマンド

| コマンド | 目的 |
|---|---|
| `constraints.scaffold` | layer 候補を含む architecture constraints YAML を scaffold する |
| `arch.load_topology` | 明示されたアーキテクチャ図や制約を読み込む |
| `arch.detect_direction_violations` | 依存方向違反を検出する |
| `arch.detect_adapter_leaks` | ポート / アダプタ境界漏れを検出する |
| `arch.detect_contract_breaks` | 契約の破壊的変更や不整合を検出する |
| `arch.detect_runtime_sharing` | ランタイム上の意図しない共有を検出する |
| `arch.score_dependency_direction` | 依存方向遵守度を採点する |
| `arch.score_boundary_purity` | 境界純度を採点する |
| `arch.score_interface_stability` | 契約安定度を採点する |
| `arch.score_topology_isolation` | トポロジ分離度を採点する |

補足:

- `model.scaffold` は `result.model` に構造化モデル、`result.yaml` にそのまま保存できる YAML 文字列、`result.contexts` / `result.aggregates` に候補と confidence を返します
- `constraints.scaffold` は `result.constraints` と `result.yaml` を返し、`scenarioObservationsTemplate` `scenarioCatalog` `topologyModel` `boundaryMap` の starter draft も `result.drafts` に返します。`scenarioObservationsTemplate` は観測値ではなく review 用テンプレートで、`needs_measurement` の形で scenario を列挙します。残りの drafts は docs-first repo の初回計測に使う叩き台であり、curated な観測値や review 済み constraints の代わりではありません
- `complexity` は stable な直接観測がない限り自動では埋めません
- どちらの scaffold も JSON の共通レスポンス契約を維持し、ファイルは自動生成しません

## 7. 実行モード

| モード | 説明 |
|---|---|
| `full_scan` | 全成果物を対象に計測する |
| `diff_scan` | PRや差分対象のみを計測する |
| `candidate_compare` | 複数設計案を比較する |
| `baseline_compare` | 過去ベースラインとの差分を見る |
| `trend` | 時系列トレンドを出す |

## 8. AI支援と決定的解析の分担

| 処理 | AI主導 | 決定的解析 |
|---|---|---|
| 用語抽出 | する | しない |
| ルール候補抽出 | する | しない |
| 曖昧性検出 | する | しない |
| 依存解析 | しない | する |
| 境界漏れ検出 | しない | する |
| 契約検証 | しない | する |
| スコア計算 | しない | する |

## 9. 標準レスポンス

```json
{
  "status": "ok",
  "result": {},
  "evidence": [],
  "confidence": 0.0,
  "unknowns": [],
  "diagnostics": [],
  "provenance": [],
  "version": "1.0"
}
```

`status` が `ok` でも、`unknowns` が空とは限らない。実務上は `status` と `confidence` を分けて扱う。
