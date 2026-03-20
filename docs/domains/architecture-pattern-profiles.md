# アーキテクチャパターンプロファイル

- 文書版数: v0.1
- 目的: pattern family ごとに、何を得て何を失うか、どの指標群を厚く見るべきかを整理する

## 1. 位置づけ

`PCS` の rule set、`OAS` の runtime metrics、`CTI` の重点項目は pattern family ごとに異なる。
本書は、それを default profile として表現する。

ここでの profile は固定ルールではなく、候補比較を始めるときの初期値である。

## 2. layered / clean / hexagonal

### 得たいもの

- dependency direction の規律
- domain isolation
- framework 依存の局所化
- testability

### 払う税

- abstraction 増加による理解コスト
- 過剰な indirection
- port / adapter の維持コスト

### 厚く見る指標

- `QSF`
- `PCS`

### 代表的な下位指標

- `DDVR`
- `LBR`
- `CPR`
- `DPR`
- `PMR`

### current runtime schema

- `FailureContainmentScore`
- `DependencyIsolationScore`
- current input path:
  - normalized `layeredRuntime`
  - または raw runtime + normalization profile

## 3. modular monolith / microservices

### 得たいもの

- independent deployment
- change locality
- fault isolation
- team autonomy

### 払う税

- distributed coordination cost
- schema / contract management
- observability cost
- on-call surface の増大

### 厚く見る指標

- `EES`
- `CTI`

### 代表的な下位指標

- `IDR`
- `SDVR`
- `SCD95`
- `DTNR`
- `CSCR`

### current runtime schema

- `PartialFailureContainmentScore`
- `RetryAmplificationScore`
- `SyncHopDepthScore`
- current input path:
  - normalized `serviceBasedRuntime`
  - または raw runtime + normalization profile

## 4. CQRS

### 得たいもの

- write-side の整合性明確化
- read path の最適化
- read / write concern の分離

### 払う税

- projection lag
- replay / backfill の運用負荷
- read freshness の説明責任

### 厚く見る指標

- `QSF`
- `OAS`
- `CTI`

### 代表的な下位指標

- `RWSC`
- `ICR`
- `PFL95`
- `RDR`
- `SCR`

### current runtime schema

- `ProjectionFreshnessScore`
- `ReplayDivergenceScore`
- `StaleReadAcceptabilityScore`
- current input path:
  - normalized `cqrsRuntime`
  - または raw runtime + normalization profile

## 5. event-driven

### 得たいもの

- boundary 間の疎結合
- async 処理による吸収
- replayable integration

### 払う税

- schema evolution cost
- idempotency 実装コスト
- dead-letter / replay 運用
- end-to-end 可観測性の難しさ

### 厚く見る指標

- `OAS`
- `CTI`

### 代表的な下位指標

- `ABR`
- `SCPR`
- `ICC`
- `DLR`
- `EL95`
- `RRSR`

### current runtime schema

- `DeadLetterHealthScore`
- `ConsumerLagScore`
- `ReplayRecoveryScore`
- current input path:
  - normalized `eventDrivenRuntime`
  - または raw runtime + normalization profile

## 6. default weight profile の考え方

`APSI` 自体の式は共通でも、候補比較で重視する観点は profile ごとに変えてよい。

### layered / clean / hexagonal

- `QSF` と `PCS` を厚くする
- current policy preset: `--profile layered`
- current preset formula: `0.35*QSF + 0.30*PCS + 0.15*OAS + 0.10*EES + 0.10*(1-CTI)`

### microservices / service-based

- `EES` と `CTI` を厚くする
- current policy preset: `--profile service_based`
- current preset formula: `0.20*QSF + 0.20*PCS + 0.15*OAS + 0.25*EES + 0.20*(1-CTI)`

### CQRS / event-driven

- `OAS` と `CTI` を厚くする
- current policy preset:
  - `CQRS`: `--profile cqrs`
  - `event-driven`: `--profile event_driven`
- current preset formula:
  - `cqrs`: `0.30*QSF + 0.15*PCS + 0.25*OAS + 0.10*EES + 0.20*(1-CTI)`
  - `event_driven`: `0.20*QSF + 0.15*PCS + 0.30*OAS + 0.10*EES + 0.25*(1-CTI)`

重みは組織やプロダクトに応じて policy として調整し、コードへ埋め込まない。
current implementation では preset を policy に持ち、`score.compute --profile ...` で切り替える。

## 7. 注意点

- pattern family は良し悪しのラベルではない
- profile は比較開始点であり、現場の quality scenario を上書きしてはならない
- 複雑性税を hidden cost にしない
