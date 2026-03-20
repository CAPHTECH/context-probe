# アーキテクチャ品質シナリオモデル

- 文書版数: v0.1
- 対象: `QSF` の入力仕様
- 目的: quality attribute scenario を、比較可能で計算可能な形に正規化する

## 1. 位置づけ

`QSF` は、アーキテクチャ評価で最初に固定すべき指標である。
なぜなら、何を良いとするかを定義しない限り、その後の `PCS` `OAS` `EES` `CTI` の解釈も定まらないからである。

本書は、QAW / ATAM で扱う quality attribute scenario を、`context_probe` が入力として扱える形に正規化する。

## 2. 基本構造

各 scenario は、少なくとも次の項目を持つ。

- `scenario_id`
- `name`
- `quality_attribute`
- `stimulus`
- `environment`
- `response`
- `response_measure`
- `direction`
- `priority`
- `target`
- `worst_acceptable`
- `scope`
- `evidence_source`

## 3. 推奨データモデル

```yaml
scenario_id: S-001
name: Checkout peak latency
quality_attribute: performance
stimulus: "利用者がピーク帯に注文確定を実行する"
environment: "ブラックフライデー当日のピークトラフィック"
response: "注文確定APIが応答する"
response_measure:
  metric: p95_latency_ms
  unit: ms
direction: lower_is_better
priority: 5
target: 250
worst_acceptable: 800
scope:
  use_case: checkout
  pattern_family: microservices
evidence_source:
  greenfield: benchmark
  brownfield: telemetry
```

## 4. 正規化式

### 4.1 lower-is-better

```text
n_s = clip((worst_s - observed_s) / (worst_s - target_s), 0, 1)
```

例:

- `p95 latency`
- `lead time`
- `projection freshness lag`
- `change fail rate`

### 4.2 higher-is-better

```text
n_s = clip((observed_s - worst_s) / (target_s - worst_s), 0, 1)
```

例:

- `independent deploy ratio`
- `failure containment ratio`
- `replay recovery success rate`

### 4.3 集計

```text
QSF = Σ(priority_s * n_s) / Σ(priority_s)
```

## 5. scenario quality の要件

良い scenario は、単に「性能が高い」のような抽象語ではなく、刺激条件と評価方法が定まっている。

最低限の要件:

- 実際の business goal と結びついている
- `response_measure` が観測可能である
- `target` と `worst_acceptable` がある
- `priority` が相対比較に使える
- greenfield / brownfield で evidence source が切り替えられる

## 6. よくある scenario 類型

### 6.1 modifiability

- 新規機能追加に必要な変更範囲
- cross-boundary co-change 率
- independent deployment ratio

### 6.2 availability / resilience

- partial failure containment
- degraded mode success ratio
- recovery time

### 6.3 performance

- p95 latency
- p99 latency
- consumer lag
- end-to-end lag

### 6.4 auditability / compliance

- evidence trace completeness
- audit event capture ratio
- policy violation detection latency

## 7. greenfield と brownfield の違い

### 7.1 greenfield

観測値は benchmark、simulation、contract test、chaos test、capacity estimation から得る。

### 7.2 brownfield

観測値は telemetry、incident、SLO、deploy history、support ticket から得る。

同じ scenario でも evidence source は phase に応じて切り替える。

## 8. 運用上の注意

- `priority` は組織横断で固定しない
- `target` は aspirational target と混同しない
- `worst_acceptable` を置かないと正規化が破綻しやすい
- scenario 数を増やしすぎると焦点がぼけるため、導入初期は top 10 程度に絞る
