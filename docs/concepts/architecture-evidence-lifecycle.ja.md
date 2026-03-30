# アーキテクチャ評価の evidence lifecycle

- 文書版数: v0.1
- 目的: greenfield と brownfield で、どの evidence source をどう切り替えるかを定義する

## 1. 基本方針

アーキテクチャ評価は、全フェーズで同じ evidence を使えるわけではない。
設計初期には telemetry も history も存在せず、本番運用に入ると benchmark だけでは不十分になる。

したがって、同じ指標式を維持しながら、phase ごとに evidence source を切り替える。

## 2. lifecycle ごとの主な evidence

| phase | 主な evidence | 主に支える指標 |
|---|---|---|
| Greenfield | scenario catalog, ADR, topology draft, static rules, benchmark, chaos test, contract test, CTI estimation | QSF, PCS, OAS(pre-prod), CTI_est |
| Early Brownfield | code, deploy logs, CI/CD history, initial telemetry, incident, Git history | PCS, OAS, EES, CTI |
| Mature Brownfield | telemetry, SLO/SLI, deploy history, incident trend, cost, on-call data, co-change history | QSF(actual), OAS, EES, CTI, APSI |

## 3. greenfield で使う evidence

### QSF

- scenario catalog
- target / worst acceptable
- benchmark
- simulation
- capacity plan

### PCS

- static dependency rules
- architecture tests
- contract tests
- design review evidence

### OAS

- pre-prod benchmark
- chaos test
- fault injection

### CTI

- deployable count estimation
- pipeline count estimation
- datastore count estimation
- run cost estimation

## 4. brownfield で使う evidence

### OAS

- latency
- errors
- saturation
- traffic bands
- telemetry export bundle
- telemetry export
- telemetry source config
- normalization profile
- consumer lag
- replay success
- DLQ rate
- family-specific pattern runtime observations
- raw pattern runtime observations
- pattern runtime normalization profile

### EES

- lead time
- deployment frequency
- recovery time
- change fail rate
- rework rate
- delivery export bundle
- delivery export
- delivery source config
- delivery normalization profile
- cross-boundary co-change
- weighted propagation cost
- weighted clustering cost

### CTI

- deployables per team
- pipelines per deployable
- contracts or schemas per service
- on-call surface
- run cost per business transaction
- complexity export bundle
- complexity source config

## 5. fitness functions の位置づけ

fitness functions は単独指標ではなく、greenfield から brownfield に渡って使える継続評価の器である。

役割:

- `PCS` の static rule を継続実行する
- `QSF` の一部を pre-prod で検証する
- `OAS` の runtime expectation を regression 化する
- `CTI` の複雑性増加を継続観測する

`OAS` については current implementation で次の段階を持つ。

1. normalized score の明示入力
2. raw telemetry export + normalization profile
3. canonical telemetry export bundle ingestion
4. canonical telemetry source config
5. family-specific normalized PatternRuntime schema
6. raw pattern runtime + normalization profile
7. 将来の telemetry backend 直結

`EES` については current implementation で次の段階を持つ。

1. normalized score の明示入力
2. raw delivery export + normalization profile
3. canonical delivery export bundle ingestion
4. canonical delivery source config
5. 将来の CI/CD backend 直結

current implementation では 3 の canonical delivery export bundle ingestion に built-in の DORA normalization defaults が含まれる。2 は raw delivery input を明示的 profile で score 化したい場合の経路として残る。

`CTI` については current implementation で次の段階を持つ。

1. static metadata / codebase-derived count
2. canonical complexity export bundle ingestion
3. canonical complexity source config
4. 将来の cost / on-call backend 直結

`QSF` については current implementation で次の段階を持つ。

1. scenario catalog + explicit scenario observations
2. canonical scenario observation source config
3. 将来の benchmark / telemetry / incident backend からの scenario actualization

reference collector は [../operations/architecture-source-collectors.ja.md](../operations/architecture-source-collectors.ja.md) に置き、source config の `command` から canonical JSON を供給する。

## 6. telemetry と history の役割分担

telemetry が主に答える問い:

- 本番の挙動は約束どおりか
- traffic band ごとに劣化していないか
- replay や partial failure に耐えられているか

history が主に答える問い:

- 変更は局所化しているか
- 実際の進化単位は architecture intent と整合しているか
- hidden relationship が co-change に現れていないか

## 7. 注意点

- greenfield の推定値と brownfield の実測値を同列に並べて解釈しない
- evidence source の成熟度は `confidence` に反映する
- observability 未整備を「問題なし」と解釈してはならない
