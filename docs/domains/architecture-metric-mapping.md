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
| `OAS` | runtime adequacy | `TIS` の一部が候補 | 部分未実装 |
| `EES` | delivery + locality | `AELS`, `EES` | 部分実装 |
| `CTI` | complexity tax | `CTI` | 部分実装 |
| `APSI` | summary index | `APSI` | 部分実装 |

## 3. current metric の意味

### `QSF`

- 主な役割: quality scenario に対する候補設計の適合度
- 実装状態: scenario catalog と observed value file を用いた初期実装
- 制約: telemetry 直結ではなく、明示入力ベースの greenfield 向け proxy から開始
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
- 制約: on-call surface や run cost は metadata 依存で、未観測時は unknown 扱い

## 5. future metric の位置づけ

### `APSI`

- 想定役割: `QSF` `PCS` `OAS` `EES` `CTI` を束ねる比較用 summary index
- 実装状態: `PCS = DDS/BPS/IPS proxy`、`OAS = TIS proxy` として初期合成を実装済み
- 制約: 下位指標の代替ではなく、意思決定の要約値としてのみ使う
- 制約: `PCS` と `OAS` は current implementation では proxy 合成であり、完成版ではない

### `TIS`

- 想定役割: runtime containment と topology isolation
- 上位指標上の位置づけ: `OAS` の bridge 指標
- 実装状態: topology model と optional runtime observation を用いた初期 proxy を実装済み
- 制約: full telemetry 直結ではなく、明示入力ベースの partial implementation

### `AELS`

- 想定役割: architecture evolution locality
- 上位指標上の位置づけ: `EES` の locality 側候補
- 実装状態: Git history と boundary map または constraints layers を使った初期実装
- 制約: delivery 指標は含まず、architecture boundary grouping の粒度に依存する

### `EES`

- 想定役割: delivery performance と historical locality を合成した進化効率
- 実装状態: `delivery-observations` と `AELS` を用いた partial implementation
- 制約: DORA raw metrics の自動収集ではなく、normalized score の明示入力から開始

## 6. 今後の推奨実装順

1. `OAS` の拡張
2. telemetry / delivery input の実測連携
3. pattern profile ごとの `APSI` 重み調整

この順にする理由は、現在すでに `APSI` の初期合成はあるため、次は summary index を賢くするより、`OAS` と delivery evidence を厚くして下位指標の質を上げる方が価値が高いからである。

## 7. 読み方

- 概念を知りたい場合は [architecture-design.md](architecture-design.md) を先に読む
- scenario 入力を定義したい場合は [architecture-scenario-model.md](architecture-scenario-model.md) を読む
- pattern family ごとの差を見たい場合は [architecture-pattern-profiles.md](architecture-pattern-profiles.md) を読む
- phase ごとの evidence source を知りたい場合は [architecture-evidence-lifecycle.md](architecture-evidence-lifecycle.md) を読む
