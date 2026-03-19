# 実行パイプラインとコマンド体系

## 1. 目的

この文書は、AIによる抽出と決定的解析をどう分離し、どのようなコマンド体系で実行するかを定義する。

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
| `code.parse` | AST / シンボル情報を構築する | AST / Symbol Table |
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
| `model.infer_context_candidates` | Context候補を推定する |
| `model.infer_aggregate_candidates` | Aggregate候補を推定する |
| `code.detect_boundary_leaks` | 境界漏れを検出する |
| `graph.build_coupling` | 境界採点用の coupling graph を作る |
| `graph.score_decomposition` | 境界分割案を採点する |
| `model.score_aggregate_fitness` | Aggregate適合度を採点する |
| `history.score_evolution_locality` | 進化局所性を採点する |

## 6. アーキテクチャ設計パック用コマンド案

| コマンド | 目的 |
|---|---|
| `arch.load_topology` | 明示されたアーキテクチャ図や制約を読み込む |
| `arch.infer_layer_candidates` | レイヤや境界候補を推定する |
| `arch.detect_direction_violations` | 依存方向違反を検出する |
| `arch.detect_adapter_leaks` | ポート / アダプタ境界漏れを検出する |
| `arch.detect_contract_breaks` | 契約の破壊的変更や不整合を検出する |
| `arch.detect_runtime_sharing` | ランタイム上の意図しない共有を検出する |
| `arch.score_dependency_direction` | 依存方向遵守度を採点する |
| `arch.score_boundary_purity` | 境界純度を採点する |
| `arch.score_interface_stability` | 契約安定度を採点する |
| `arch.score_topology_isolation` | トポロジ分離度を採点する |

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
