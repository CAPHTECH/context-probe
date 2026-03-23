# アーキテクチャ設計評価仕様

- 文書版数: v0.2
- 評価領域ID: `architecture_design`
- 位置づけ: 詳細仕様へ移行中
- 目的: アーキテクチャパターンを一般論で採点せず、特定システムの制約下にある設計案の適合性を証拠ベースで比較する

## 1. この評価領域が答える問い

アーキテクチャ設計評価は、主に次の問いへ答える。

1. このシステムにとって重要な品質シナリオに、設計案はどれだけ適合しているか
2. 実装は、選んだアーキテクチャパターンの規律をどれだけ守っているか
3. 本番の実行時挙動は、そのパターンが約束する性質を満たしているか
4. 実際の変更は局所化され、進化単位は設計意図と整合しているか
5. そのパターンがもたらす追加複雑性を、得られる利得が上回っているか

## 2. 評価単位

本領域が評価する対象は、`layered`、`hexagonal`、`microservices` のような抽象パターンそのものではない。

評価単位は、次を前提にした具体的な設計案である。

- business goal
- quality attribute scenario
- 組織制約
- 運用制約
- データ制約
- セキュリティ / 監査制約

したがって、同じパターン名でも、求められる品質シナリオが異なれば評価結果は変わる。
比較は、同一プロダクト内の候補案比較か、同一プロダクトの時系列比較に限定する。

## 3. 基本原則

1. アーキテクチャ評価は `scenario first` で始める
2. AIは自由採点を行わず、evidence 抽出と曖昧性整理を支援する
3. スコアは固定式で計算し、必ず `evidence` `confidence` `unknowns` を伴う
4. 品質向上の得点と複雑性の税を混ぜない
5. greenfield と brownfield では、同じ式でも evidence source を切り替える

## 4. 評価フレーム

本領域は、次の考え方を統合して設計する。

- QAW: business goal から architecture-critical な quality scenarios を洗い出す
- ATAM: scenario に対する tradeoff と risk を評価する
- CBAM: cost / benefit / ROI を分離して扱う
- fitness functions: パターン準拠を objective で quantifiable なルールとして継続実行する
- telemetry / history: 実行時挙動と進化効率を実測で補完する

このため、評価は次の順序で行う。

1. 何を良いとするかを scenario で定義する
2. 選んだパターンに求める規律を static rules として定義する
3. 実装、運用、履歴から本当にそう振る舞っているかを検証する
4. 得られた利得と複雑性税を分けて比較する

## 5. 上位指標体系

### 5.1 `APSI`: Architecture Pattern Suitability Index

```text
APSI = 0.30 * QSF
     + 0.20 * PCS
     + 0.20 * OAS
     + 0.15 * EES
     + 0.15 * (1 - CTI)
```

- `QSF`: Quality Scenario Fit
- `PCS`: Pattern Conformance Score
- `OAS`: Operational Adequacy Score
- `EES`: Evolution Efficiency Score
- `CTI`: Complexity Tax Index

`APSI` は意思決定の要約値であり、単独で設計の良否を断定しない。
必ず下位スコアと evidence を併記する。

### 5.2 `QSF`: Quality Scenario Fit

`QSF` は、QAW / ATAM の scenario ベース評価を定量化したものとする。

各 scenario `s` について、少なくとも次を持つ。

- `stimulus`
- `environment`
- `response`
- `response_measure`
- `priority`
- `target`
- `worst_acceptable`

lower-is-better の正規化:

```text
n_s = clip((worst_s - observed_s) / (worst_s - target_s), 0, 1)
```

higher-is-better の正規化:

```text
n_s = clip((observed_s - worst_s) / (target_s - worst_s), 0, 1)
```

集計式:

```text
QSF = Σ(priority_s * n_s) / Σ(priority_s)
```

`QSF` が意味するのは、パターン一般論への適合ではなく、そのシステムにとって重要な品質目標への適合である。

### 5.3 `PCS`: Pattern Conformance Score

`PCS` は、選択したアーキテクチャパターンに固有の規律を実装が守っているかを表す。

```text
PCS = Σ(weight_r * result_r) / Σ(weight_r)
```

ここで `result_r` は、0/1 でも連続値でもよい。
重要なのは、rule set が pattern family ごとに切り替わることである。

`PCS` は static analysis と fitness functions の中心領域であり、現行実装の `DDS` `BPS` `IPS` はこの下位スコアとして位置づける。

### 5.4 `OAS`: Operational Adequacy Score

`OAS` は、本番の実行時挙動がそのパターンの約束を満たしているかを表す。

共通基盤は Google SRE の four golden signals を採るが、`traffic` は評価対象ではなく、他指標を層別化する条件変数として扱う。

traffic band ごとの集計:

```text
band_score_b = 0.45 * LatencyScore_b
             + 0.35 * ErrorScore_b
             + 0.20 * SaturationScore_b
```

共通実行時スコア:

```text
CommonOps = Σ(traffic_weight_b * band_score_b)
```

総合:

```text
OAS = 0.50 * CommonOps + 0.50 * PatternRuntime
```

`PatternRuntime` には pattern-specific runtime metrics を入れる。

### 5.5 `EES`: Evolution Efficiency Score

`EES` は、delivery performance と historical locality を分けて扱う。

delivery 側:

```text
Delivery = 0.25 * LeadTimeScore
         + 0.20 * DeployFreqScore
         + 0.20 * RecoveryScore
         + 0.20 * (1 - ChangeFailScore)
         + 0.15 * (1 - ReworkScore)
```

locality 側:

```text
Locality = 0.40 * (1 - CrossBoundaryCoChange)
         + 0.30 * (1 - WeightedPropagationCost)
         + 0.30 * (1 - WeightedClusteringCost)
```

総合:

```text
EES = 0.60 * Delivery + 0.40 * Locality
```

ここでの論点は、パッケージ図の整然さではなく、実際の変更単位が局所化しているかである。

### 5.6 `CTI`: Complexity Tax Index

`CTI` は、選んだパターンが追加で払わせる運用税・認知税を表す。

```text
CTI = 0.20 * DeployablesPerTeam
    + 0.15 * PipelinesPerDeployable
    + 0.15 * ContractsOrSchemasPerService
    + 0.10 * DatastoresPerServiceGroup
    + 0.15 * OnCallSurface
    + 0.10 * SyncDepthOverhead
    + 0.15 * RunCostPerBusinessTransaction
```

`CTI` は絶対数ではなく、business volume や team capacity で正規化する。
この指標を別立てにしないと、複雑なパターンを「高度な設計」と誤認しやすい。

## 6. pattern family ごとの重点

同じ `APSI` でも、pattern family によって重く見る下位スコアは異なる。

### 6.1 layered / clean / hexagonal

- 主戦場: `QSF` と `PCS`
- 重点論点: dependency discipline、domain isolation、framework contamination、port 経由性
- `OAS` と `CTI` は補助的だが、failure containment は無視しない

### 6.2 modular monolith / microservices

- 主戦場: `EES` と `CTI`
- 重点論点: independent deployability、cross-boundary co-change、shared database、sync depth、運用面の coordination cost
- 見かけ上の分割ではなく、進化単位と運用税を見る

### 6.3 CQRS

- 主戦場: `QSF` `OAS` `CTI`
- 重点論点: write-side の invariant closure、projection freshness、replay divergence、stale read の許容性

### 6.4 event-driven

- 主戦場: `OAS` `CTI`
- 重点論点: schema compatibility、idempotency、dead-letter、replay recovery、end-to-end lag

## 7. 現時点の下位指標例

pattern family ごとの典型的な下位指標例を示す。
これらは current implementation と future implementation の混在を含む。

### 7.1 layered / clean / hexagonal の例

- `DDVR`: forbidden dependency edges / total dependency edges
- `LBR`: layer bypass calls / total cross-layer calls
- `CPR`: nodes participating in cycles / total nodes
- `DPR`: framework 依存のない domain classes / total domain classes
- `PMR`: port 経由の外部 I/O / total external I/O

### 7.2 service-based / microservices の例

- `IDR`: single-service deployments / all deployments
- `SDVR`: shared-database or cross-service write violations / all service data accesses
- `SCD95`: p95 synchronous call depth per request
- `DTNR`: critical use cases needing atomic multi-service writes / critical use cases
- `CSCR`: cross-service co-change ratio

### 7.3 CQRS の例

- `RWSC`: read/write path separation coverage
- `ICR`: write-side transaction 内に閉じる strong invariants / all strong invariants
- `PFL95`: p95 projection freshness lag
- `RDR`: replay divergence rate
- `SCR`: stale-read related complaints or incidents / total relevant interactions

### 7.4 event-driven の例

- `ABR`: asynchronous durable messaging across intended boundaries / total intended boundary interactions
- `SCPR`: schema compatibility pass rate
- `ICC`: idempotent consumer coverage
- `DLR`: dead-letter rate
- `EL95`: p95 end-to-end lag
- `RRSR`: replay recovery success rate

## 8. greenfield / brownfield の切替

greenfield と brownfield では観測可能な evidence が異なる。

### 8.1 greenfield

主に次を使う。

- `QSF`: scenario fit
- `PCS`: rule と構造の妥当性
- pre-prod benchmark
- chaos / contract test
- `CTI_est`: 想定される運用税

### 8.2 brownfield

主に次を使う。

- `QSF`: 実測 scenario fit
- `PCS`: 継続 fitness function
- `OAS`: telemetry
- `EES`: delivery metrics + history locality
- `CTI`: 実測された運用税

同じ式を使いながら、evidence source を phase に応じて切り替えることが重要である。

## 9. 初期導入セット

最初から全指標を入れる必要はない。
導入初期は、次の 9 項目を最小セットとする。

- `QSF`: top 10 scenario の weighted score
- `PCS`: dependency rule pass rate
- `PCS`: cycle participation ratio
- `OAS`: p95 latency / error / saturation by traffic band
- `EES`: lead time
- `EES`: change fail rate
- `EES`: cross-boundary co-change ratio
- `CTI`: deployables per team
- `CTI`: on-call surface

これにより、パターン適合性、実装準拠、本番挙動、変更局所性、複雑性税の5観点を最小コストで観測できる。

## 10. 対象成果物

### 10.1 設計成果物

- architecture vision
- business goal
- quality attribute scenario catalog
- ADR
- layer / port / service / contract 規約
- component / topology / service / deployment diagram
- ownership / team boundary / security zone

### 10.2 実装成果物

- application code
- build / module definition
- API / event / schema contracts
- IaC / deploy manifest
- runtime configuration

### 10.3 履歴・運用成果物

- Git history
- CI / CD history
- deploy history
- incident / postmortem
- metrics / traces / logs
- SLO / SLI
- runbook / dashboard / alert rule

## 11. 現行実装との関係

現行の `architecture_design` 実装は、主に `PCS` の下位部品を構成している。

- `DDS`: dependency direction と abstraction path の適合
- `BPS`: boundary purity の適合
- `IPS`: interface / contract stability の適合

補足:

- `IPS` の現行実装は JS / TS に加えて Dart も対象とし、Dart では public top-level 宣言と contract import を proxy として評価する
- Dart の `part of` と `*.g.dart` などの生成ファイルは raw dependency には残すが、採点時の主対象からは除外する

今後追加される想定:

- `TIS`: `OAS` と runtime containment の bridge 指標
- `AELS`: `EES` の locality 側に近い指標
- `QSF`: scenario model と benchmark / telemetry に基づく評価
- `CTI`: complexity tax の観測
- `APSI`: 下位スコアを要約する比較用指数

詳細な対応表は [architecture-metric-mapping.md](architecture-metric-mapping.md) を参照する。

## 12. 注意点

- パターン名の一般論で採点してはいけない
- `APSI` を単独で運用してはいけない
- pattern-specific metrics は family ごとに切り替える
- greenfield の想定値と brownfield の実測値を混同してはいけない
- `CTI` を除外すると、複雑な設計が不当に有利に見える
