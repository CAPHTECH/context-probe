# アーキテクチャ指標マッピング

- 文書版数: v0.1
- 目的: APSI モデルと current implementation の対応を明示する

## 1. 位置づけ

本書は、概念仕様と current implementation のズレを管理するための対応表である。
仕様上の上位概念と、現時点で CLI に実装済みの metric / future metric を混同しないために置く。

## 2. 上位指標と current implementation

| 上位指標 | 役割 | current implementation | 状態 |
|---|---|---|---|
| `QSF` | scenario fit | `QSF` | 部分実装 |
| `PCS` | pattern rule conformance | `DDS`, `BPS`, `IPS` | 実装済み |
| `OAS` | runtime adequacy | `OAS`, `TIS` | 部分実装 |
| `EES` | delivery + locality | `AELS`, `EES` | 部分実装 |
| `CTI` | complexity tax | `CTI` | 部分実装 |
| `APSI` | summary index | `APSI` | 部分実装 |

## 3. current metric の意味

### `QSF`

- 主な役割: quality scenario に対する候補設計の適合度
- 実装状態: scenario catalog と `scenario-observations`、または `scenario-observation-source` から取り込んだ actual observation を用いた部分実装
- 制約: raw telemetry を直接読むのではなく、scenario 単位へ要約された観測を入力にする
- 制約: vendor API 直結ではなく canonical source config 経由の取り込みから開始する
### `DDS`

- 主な役割: dependency direction と abstraction path の適合
- 上位指標上の位置づけ: `PCS` の構成要素

### `BPS`

- 主な役割: boundary purity の適合
- 上位指標上の位置づけ: `PCS` の構成要素

### `IPS`

- 主な役割: interface / contract stability の適合
- 上位指標上の位置づけ: `PCS` の構成要素

## 4. `CTI` の位置づけ

### `CTI`

- 想定役割: deployable / pipeline / contract / sync depth などの complexity tax を独立に可視化する
- 実装状態: static metadata と codebase-derived count による初期 proxy を実装済み
- 実装状態: `complexity-export` bundle、または `complexity-source` から取り込んだ canonical export を ingest して CTI component に反映できる
- 制約: on-call surface や run cost は metadata 依存で、未観測時は unknown 扱い

## 5. future metric の位置づけ

### `TIS`

- 想定役割: runtime containment と topology isolation
- 上位指標上の位置づけ: `OAS` の bridge 指標
- 実装状態: topology model と optional runtime observation を用いた初期 proxy を実装済み
- 制約: full telemetry 直結ではなく、明示入力ベースの partial implementation

### `OAS`

- 想定役割: traffic band ごとの運用健全性と pattern-specific runtime adequacy の合成
- 実装状態: `telemetry-observations`、`telemetry-raw-observations + telemetry-normalization-profile`、`telemetry-export + telemetry-normalization-profile`、`telemetry-source + telemetry-normalization-profile` を使った partial implementation を実装済み
- 実装状態: `pattern-runtime-observations` の family-specific normalized schema に加え、`pattern-runtime-raw-observations + pattern-runtime-normalization-profile` からも `PatternRuntime` を導出できる
- 制約: raw telemetry 自動取得ではなく file-based normalization から開始
- 制約: source config は canonical export / command stdout(JSON) を読む adapter 層であり、vendor API client はまだ持たない
- 制約: pattern runtime observation がない場合は `TIS` bridge を使う
- 制約: telemetry export は canonical ingest schema を前提とし、vendor API 直結ではない

### `AELS`

- 想定役割: architecture evolution locality
- 上位指標上の位置づけ: `EES` の locality 側候補
- 実装状態: Git history と boundary map または constraints layers を使った初期実装
- 制約: delivery 指標は含まず、architecture boundary grouping の粒度に依存する

### `EES`

- 想定役割: delivery performance と historical locality を合成した進化効率
- 実装状態: `delivery-observations` に加えて `delivery-raw-observations + delivery-normalization-profile`、`delivery-export + delivery-normalization-profile`、`delivery-source + delivery-normalization-profile` と `AELS` を用いた partial implementation
- 制約: DORA raw metrics の自動収集ではなく、file-based normalization から開始

### `APSI`

- 想定役割: `QSF` `PCS` `OAS` `EES` `CTI` を束ねる比較用 summary index
- 実装状態: `PCS = DDS/BPS/IPS proxy`、`OAS = OAS metric (未観測時は TIS bridge fallback)` として初期合成を実装済み
- 実装状態: `default` `layered` `service_based` `cqrs` `event_driven` の policy profile で比較重みを切り替えられる
- 制約: 下位指標の代替ではなく、意思決定の要約値としてのみ使う
- 制約: `PCS` と `OAS` は current implementation では proxy / partial 実装を含む
- 運用上の扱い: `report.generate` では summary section に分離し、`gate.evaluate` では supporting metric を主判定対象とする
- 運用上の扱い: active profile は report に表示されるが、`patternFamily` 自動推定とは結びつけない

## 6. 今後の推奨実装順

1. canonical source config の vendor adapter 拡張
2. QSF actual observation source の backend 連携強化
3. CTI export の vendor adapter 拡張
4. profile preset の現場最適化

この順にする理由は、現在すでに `APSI` の profile 別重み、family-specific runtime schema、pattern runtime raw normalization、delivery raw normalization、canonical export/source ingestion はあるため、次は summary index の微調整より backend 由来の実測 evidence を厚くして下位指標の質を上げる方が価値が高いからである。

## 7. 読み方

- 概念を知りたい場合は [architecture-design.md](architecture-design.md) を先に読む
- scenario 入力を定義したい場合は [architecture-scenario-model.md](architecture-scenario-model.md) を読む
- pattern family ごとの差を見たい場合は [architecture-pattern-profiles.md](architecture-pattern-profiles.md) を読む
- phase ごとの evidence source を知りたい場合は [architecture-evidence-lifecycle.md](architecture-evidence-lifecycle.md) を読む
