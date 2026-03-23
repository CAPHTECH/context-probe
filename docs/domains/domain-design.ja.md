# ドメイン設計評価仕様

- 文書版数: v0.1
- 評価領域ID: `domain_design`
- 位置づけ: 最初の詳細実装対象
- 目的: ドメイン設計の良否を、証拠ベースで定量評価する

## 1. この評価領域が答える問い

ドメイン設計評価は、主に次の問いへ答える。

1. 用語は一貫しているか
2. 業務ルールと不変条件はモデルに適切に反映されているか
3. Bounded Context の分割は意味論的にも進化上も妥当か
4. Aggregate は強い不変条件を閉じ込めているか
5. 実装は設計上の契約や境界に従っているか
6. 実際の変更は局所化されているか

## 2. 対象成果物

### 2.1 設計成果物

- Vision / PRD
- ユースケース、ユーザーストーリー
- 用語集、Glossary
- 業務ルール一覧
- 不変条件一覧
- Context Map
- Aggregate図
- EventStorming 成果物
- ADR
- API仕様、イベント仕様、契約DTO定義
- Ownership / Team境界 / セキュリティゾーン情報

### 2.2 実装成果物

- アプリケーションコード
- テストコード
- モジュール定義、ビルド定義
- 設定ファイル
- スキーマ定義

### 2.3 履歴

- Git履歴
- PR情報
- Issue / Ticket情報
- リリース情報

## 3. 主要機能

プラットフォーム共通の取り込み機能を前提に、ドメイン設計評価では次の機能を扱う。

| ID | 機能 | 概要 | 主な出力 |
|---|---|---|---|
| D1 | 用語抽出・正規化 | ドメイン用語、別名、衝突語を抽出する | Glossary Graph |
| D2 | ルール・不変条件抽出 | 業務ルールと不変条件を抽出する | Rule / Invariant Catalog |
| D3 | モデル読込・候補生成 | Context / Aggregate の明示モデル読込または候補推定 | Domain Model Graph |
| D4 | 追跡リンク生成 | 文書、モデル、コードの関連を張る | Traceability Graph |
| D5 | 構造解析 | 依存、契約、参照を解析する | Dependency Graph |
| D6 | 境界漏れ検出 | cross-context の内部参照や契約逸脱を検出する | Leak Findings |
| D7 | 境界適合評価 | Bounded Context 分割案を採点する | Boundary Score |
| D8 | Aggregate適合評価 | 不変条件の閉包性を評価する | Aggregate Fitness |
| D9 | 進化局所性解析 | 履歴から変更の局所性を評価する | Evolution Score |
| D10 | スコア計算 | 各指標と比較用指数を算出する | Metric Scores |
| D11 | 人手レビュー支援 | 未確定事項をレビュー対象として提示する | Review Queue |

## 4. 機能詳細

### D1. 用語抽出・正規化

#### 主コマンド

- `doc.extract_glossary`
- `trace.link_terms`

#### 処理

1. 文書、コード、API仕様から用語候補を抽出する
2. canonical term を推定する
3. alias cluster を形成する
4. 使用コンテキストを割り当てる
5. 衝突語と曖昧語を検出する

#### 出力例

```json
{
  "canonical_term": "Customer",
  "aliases": ["Client", "AccountHolder"],
  "contexts": ["CRM", "Billing"],
  "collision": true,
  "evidence": [
    {"artifact_id": "doc-12", "fragment_id": "p-18"},
    {"artifact_id": "code-4", "symbol": "BillingCustomer"}
  ],
  "confidence": 0.82,
  "unknowns": ["CRMとBillingのCustomerが同一概念か未確定"]
}
```

#### 寄与する指標

- `GC`: Glossary Coverage
- `AE`: Alias Entropy
- `TC`: Term Collision Rate
- `TL`: Traceability Link Coverage

### D2. ルール・不変条件抽出

#### 主コマンド

- `doc.extract_rules`
- `doc.extract_invariants`

#### 分類対象

- 業務ルール
- 強い不変条件
- プロセス不変条件
- 外部制約
- セキュリティ制約
- 監査 / コンプライアンス制約

#### 出力例

```json
{
  "rule_id": "R-014",
  "type": "strong_invariant",
  "statement": "注文確定後は決済総額と明細合計が常に一致していなければならない",
  "related_terms": ["注文", "決済", "明細"],
  "candidate_aggregate": ["Order"],
  "evidence": [
    {"artifact_id": "doc-20", "fragment_id": "p-44"}
  ],
  "confidence": 0.89,
  "unknowns": []
}
```

#### 寄与する指標

- `RC`: ルール被覆率
- `SIC`: Strong Invariant Closure
- `XTC`: Cross-Aggregate Transaction Need

### D3. モデル読込・候補生成

#### 主コマンド

- `model.load`
- `model.infer_context_candidates`
- `model.infer_aggregate_candidates`

#### 要件

- 明示モデルと推定候補を区別する
- 推定候補には `confidence` と `unknowns` を付ける
- ownership、security、use case 群、用語、ルールを根拠に候補を作る

### D4. 追跡リンク生成

#### 主コマンド

- `trace.link_terms`
- `trace.link_rules`
- `trace.link_model_to_code`

#### 生成するリンク

- 文書 ↔ 用語
- 用語 ↔ モデル要素
- モデル要素 ↔ コードシンボル
- ルール ↔ Aggregate / Context

この機能がないと、スコアは出ても「なぜそうなったか」を説明しにくい。

### D5. 構造解析

#### 主コマンド

- `code.parse`
- `code.detect_dependencies`
- `code.detect_contract_usage`

#### 処理

- AST / シンボルテーブル構築
- パッケージ、モジュール、名前空間ごとの依存抽出
- API / DTO / Event / Internal Type の分類
- 設定やビルド定義からの補助情報収集

### D6. 境界漏れ検出

#### 主コマンド

- `code.detect_boundary_leaks`

#### 検出対象

- 別コンテキストの internal type 参照
- 契約DTOを経由しない直接依存
- 禁止された cross-context import
- データベーススキーマの越境参照
- イベント契約を経由しない内部イベント利用

#### 出力例

```json
{
  "finding_id": "BL-0031",
  "severity": "high",
  "source_context": "Fulfillment",
  "target_context": "Billing",
  "violation_type": "direct_internal_type_reference",
  "source_symbol": "FulfillmentService",
  "target_symbol": "BillingInvoiceEntity",
  "evidence": [
    {
      "artifact_id": "repo-main",
      "path": "src/fulfillment/FulfillmentService.kt",
      "line": 128
    }
  ],
  "confidence": 0.99
}
```

#### 寄与する指標

- `BLR`: Boundary Leak Ratio
- `MRP`: Model Rule Pass Rate
- `CLA`: Contract Language Adherence

### D7. 境界適合評価

#### 主コマンド

- `graph.build_coupling`
- `graph.score_decomposition`

#### 引き寄せる力

- 同じ強い不変条件
- 同じライフサイクル
- 同じユースケース群
- 同じ利用者 / 所有者
- 意味的近接
- 同じ整合性要求

#### 分ける力

- 異なる ownership
- 異なる security zone
- 異なる変更頻度
- 異なる監査・コンプライアンス要件
- 明示的な分離方針

#### 出力

- 候補境界ごとの `A(P)` と `R(P)`
- `Boundary Fitness Score`
- 分割案の比較ランキング
- 問題エッジ一覧

### D8. Aggregate適合評価

#### 主コマンド

- `model.score_aggregate_fitness`

#### 評価観点

- 強い不変条件が単一Aggregate内に閉じているか
- 単一コマンドが複数Aggregateへの強整合書き込みを要求していないか
- Aggregate が大きすぎて責務過多になっていないか

### D9. 進化局所性解析

#### 主コマンド

- `history.mine_cochange`
- `history.score_evolution_locality`

#### 処理

- commit 単位の co-change 抽出
- ticket / issue 単位の関連づけ
- bulk rename、formatter、依存更新などのノイズ除去
- Bounded Context 単位への変更集約

#### 出力

- Cross-context co-change graph
- Feature scatter
- Surprise coupling candidates
- `ELS`: Evolution Locality Score

### D10. スコア計算

#### 主コマンド

- `score.compute`

#### 設計原則

- スコア関数は宣言的設定で管理する
- AIがその場で重みを発明しない
- 計算過程を追跡できる

### D11. 人手レビュー支援

#### 主コマンド

- `review.list_unknowns`
- `review.resolve`

#### 主なレビュー対象

- 同義語か別概念か判断が難しい用語群
- 強い不変条件かプロセス不変条件か曖昧なルール
- Context割当が複数候補に割れるモデル要素
- ownership / security 情報が欠損した境界候補

## 5. 指標体系

### 5.1 指標一覧

| 指標 | 意味 | 主な入力 | 自動化レベル |
|---|---|---|---|
| `DRF` | Domain Representation Fitness | ユースケース、ルール、モデル、レビュー結果 | 半自動 |
| `ULI` | Ubiquitous Language Integrity | 用語集、文書、コード、モデル | 高 |
| `BFS` | Boundary Fitness Score | モデル、ユースケース、ownership、security | 半自動 |
| `AFS` | Aggregate Fitness Score | 不変条件、Aggregate定義、コマンド責務 | 半自動 |
| `MCCS` | Model-to-Code Conformance Score | コード、契約、設計ルール | 高 |
| `ELS` | Evolution Locality Score | Git履歴、Issue、Context grouping | 高 |

### 5.2 指標定義

#### `DRF`: Domain Representation Fitness

```text
DRF = 0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA
```

- `SC`: ユースケース被覆率
- `RC`: ルール被覆率
- `IV`: 無効 / 不適切なモデル記述率
- `RA`: レビュー一致度

#### `ULI`: Ubiquitous Language Integrity

```text
ULI = 0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL
```

- `GC`: Glossary Coverage
- `AE`: Alias Entropy
- `TC`: Term Collision Rate
- `TL`: Traceability Link Coverage

#### `BFS`: Boundary Fitness Score

```text
A(P) = Σ a_ij [same_context(i,j)] / Σ a_ij
R(P) = Σ r_ij [different_context(i,j)] / Σ r_ij
BFS = 0.5*A(P) + 0.5*R(P)
```

#### `AFS`: Aggregate Fitness Score

```text
AFS = 0.60*SIC + 0.40*(1-XTC)
```

- `SIC`: Strong Invariant Closure
- `XTC`: Cross-Aggregate Transaction Need

#### `MCCS`: Model-to-Code Conformance Score

```text
MCCS = 0.50*MRP + 0.25*(1-BLR) + 0.25*CLA
```

- `MRP`: Model Rule Pass Rate
- `BLR`: Boundary Leak Ratio
- `CLA`: Contract Language Adherence

#### `ELS`: Evolution Locality Score

```text
ELS = 0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)
```

- `CCL`: Cross-Context Change Locality
- `FS`: Feature Scatter
- `SCR`: Surprise Coupling Ratio

### 5.3 比較用総合指数

#### 実装前評価

```text
DDFI_pre = 0.35*DRF + 0.20*ULI + 0.30*BFS + 0.15*AFS
```

#### 実装後評価

```text
DDFI_post = 0.20*DRF + 0.15*ULI + 0.20*BFS + 0.15*AFS + 0.10*MCCS + 0.20*ELS
```

総合指数は、組織横断の絶対評価ではなく、候補比較と時系列比較に使う。

## 6. 代表ユースケース

### 6.1 Greenfield: 設計案比較

- アーキテクトが3つの Context Map 案を持っている
- `BFS` `ULI` `DRF` を比較し、採用候補を絞る

### 6.2 Brownfield: 既存モノリスの境界再設計

- 既存コードとGit履歴から、どこで境界漏れと co-change が起きているかを把握する
- `BLR` と `ELS` を基点に再設計候補を出す

### 6.3 CI: 日次の設計劣化監視

- PRで新たな boundary leak が増えたら失敗
- term collision を要レビューに回す
- `MCCS` や `MRP` の低下を警告する

## 7. 受け入れ基準

### 7.1 機能受け入れ

1. 文書断片、コード位置、コミット情報に共通IDが付与されている
2. `ULI` `MCCS` `ELS` が evidence 付きで返る
3. 境界漏れ検出時に、該当シンボルと位置が表示される
4. `confidence` と `unknowns` が全コマンドで出力される
5. ベースラインとの差分比較ができる
6. 設定ファイル変更で計算式と閾値が反映される

### 7.2 品質受け入れ

1. 同一入力で結果が安定する
2. 人手レビュー結果が再計測に反映される
3. 誤検知の根拠が追跡できる
4. レポートがスコアだけで終わらず、証拠へ辿れる

## 8. リスクと対策

| リスク | 内容 | 対策 |
|---|---|---|
| 過度な自動化 | AIが誤った前提で断定する | `confidence` `unknowns` `review` を必須化する |
| 入力不足 | 用語集やルールが未整備で計測の意味が薄れる | 観測可能性不足として別出力にする |
| 指標の誤用 | 総合指数だけで設計を断定する | 比較用途と限界を明示する |
| ノイズ履歴 | bulk change が co-change を汚す | 履歴フィルタと除外ルールを持つ |
