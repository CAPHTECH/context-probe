# 共通計測モデル

## 1. 目的

この文書は、ドメイン設計評価にもアーキテクチャ設計評価にも共通する計測モデルを定義する。評価領域が増えても、証拠の扱い方、スコア計算の仕方、レビュー運用が変わらないことを目的とする。

## 2. 基本構造

プラットフォームは「共通基盤」と「評価パック」で構成する。

### 2.1 共通基盤

- 成果物取り込み
- 正規化
- provenance 付与
- Evidence 管理
- Score 計算エンジン
- Review Queue
- レポート / CI / ベースライン比較

### 2.2 評価パック

各評価パックは、ある設計領域に固有のルールを持つ。

| 構成要素 | 内容 |
|---|---|
| `artifact_profile` | どの成果物を必要とするか |
| `extractors` | AIで抽出する情報 |
| `deterministic_analyzers` | 決定的に検証する解析器 |
| `metric_definitions` | 指標式、構成要素、閾値 |
| `review_rules` | 人手レビュー必須条件 |
| `report_views` | ダッシュボード表示単位 |

## 3. 計測ライフサイクル

全評価領域で、計測は次の流れを取る。

1. `ingest`
   - 文書、コード、履歴、運用データを収集する
2. `normalize`
   - 断片ID、シンボルID、コミットID、Issue ID を安定化する
3. `extract`
   - AIが用語、ルール、候補境界、曖昧性を抽出する
4. `analyze`
   - 決定的解析器が依存、履歴、契約、規約違反を検証する
5. `score`
   - 設定ファイルと固定式でスコア算出する
6. `review`
   - `confidence` と `unknowns` に基づいて人手レビュー対象を出す
7. `report`
   - 現状、候補比較、差分、時系列の各ビューへ展開する

## 4. スコアの考え方

### 4.1 スコアは 0.0 から 1.0 の正規化値

- 0.0 は最悪を意味するのではなく、当該指標上の不適合が大きい状態を表す
- 1.0 は完全無欠を意味するのではなく、定義された観測範囲内で高い適合を示す

### 4.2 スコア式は宣言的に管理する

- 指標式は設定ファイルに置く
- 実行時にAIが重みや式を発明しない
- 比較結果の説明可能性を保つ

### 4.3 confidence と score は別物

- `score` は観測された証拠に対する算術結果
- `confidence` は、その算術の入力がどれだけ十分な証拠に支えられているか

低 confidence で高 score の結果は「良い」とは限らず、「観測不足の可能性がある」と解釈する。

## 5. 評価単位

全評価領域で、次の比較単位を共通サポートする。

| 比較単位 | 説明 |
|---|---|
| 現状評価 | 単一時点の評価 |
| 候補比較 | 案A / 案B / 案C の比較 |
| ベースライン比較 | 前回計測との差分 |
| PR差分 | 変更範囲だけを対象とした評価 |
| 時系列比較 | トレンド確認 |

## 6. レビュー運用モデル

### 6.1 レビューが必要な条件

次の条件に一致したものは、自動採点だけで閉じず `Review Queue` に送る。

- `confidence < threshold`
- `unknowns_count > 0`
- collision や classification ambiguity がある
- 評価パック固有の高リスク条件に該当する

### 6.2 レビューの結果

人手レビューは次のいずれかを返す。

- 承認
- 修正
- 保留
- スコープ外

この結果は `Review Resolution Log` として保存し、次回の再計測に反映する。

## 7. 評価パックの最小インターフェース

```yaml
domain_pack:
  id: domain_design
  version: 0.1
  inputs:
    required:
      - documents
      - repository
    optional:
      - issues
      - adrs
  extractors:
    - doc.extract_glossary
    - doc.extract_rules
  analyzers:
    - code.detect_dependencies
    - history.mine_cochange
  metrics:
    - ULI
    - MCCS
    - ELS
  review_rules:
    - "confidence < 0.75"
    - "unknowns_count > 0"
```

## 8. 共通出力契約

全コマンドは最低限次の構造を返す。

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

### 8.1 必須フィールドの意味

- `status`: 成功、警告、失敗の状態
- `result`: 主結果
- `evidence`: 根拠となる断片や検出結果
- `confidence`: 証拠充足度
- `unknowns`: 未確定事項
- `diagnostics`: 実行上の注意や不足入力
- `provenance`: 元ファイル、元行、元コミットへの追跡情報
- `version`: 出力契約の版数

## 9. 初期評価領域カタログ

| 領域 | 実装方針 | 主指標 |
|---|---|---|
| ドメイン設計 | 先行実装 | `DRF` `ULI` `BFS` `AFS` `MCCS` `ELS` |
| アーキテクチャ設計 | 次期拡張 | `DDS` `BPS` `IPS` `TIS` `AELS` |

## 10. 拡張ルール

新しい評価領域を追加するときは、少なくとも次を満たす。

1. 既存の共通出力契約に従う
2. どの部分がAI抽出で、どの部分が決定的解析かを明示する
3. 指標式を設定ファイルで表現できる
4. `confidence` と `unknowns` を返す
5. レビュー必須条件を定義する
