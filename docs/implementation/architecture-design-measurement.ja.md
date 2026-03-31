# アーキテクチャ設計の current implementation

この文書は `architecture_design` の current implementation を説明します。

概念上の数式は [../concepts/architecture-design.ja.md](../concepts/architecture-design.ja.md)、人間向けの読み方は [../reference/architecture-design-metrics.ja.md](../reference/architecture-design-metrics.ja.md) を参照します。

## source of truth

- コマンド分岐: `src/commands.ts`
- スコア合成: `src/core/scoring.ts`
- report / gate: `src/core/report.ts`
- policy default: `src/core/policy.ts`

## 現在の処理フロー

`score.compute --domain architecture_design` は現在おおむね次を行います。

1. policy と constraints を読む
2. リポジトリを解析する
3. 静的適合を計算する: `DDS` `BPS` `IPS`
4. scenario / topology を計算する: `QSF` `TIS`
5. telemetry / pattern runtime を ingest / normalize して `OAS` を作る
6. delivery を ingest / normalize して `EES` を作る
7. complexity 入力から `CTI` を作る
8. architecture locality から `AELS` を作る
9. supporting metrics を束ねて `APSI` を作る

## 概念仕様と current implementation の対応

| 概念上の metric | current implementation | 状態 |
|---|---|---|
| `QSF` | `QSF` | scenario observation が薄いと partial |
| `PCS` | `DDS` `BPS` `IPS` | supporting metrics で表現 |
| `OAS` | `OAS` と `TIS` bridge | runtime signal が薄いと partial |
| `EES` | `EES` と `AELS` | delivery または history が薄いと partial |
| `CTI` | `CTI` | metadata 不足時は partial |
| `APSI` | `APSI` | summary-only |

## 入力の優先順位

### scenario input

1. `scenario-observations`
2. `scenario-observation-source`
3. それ以外は `QSF` 未観測

`constraints.scaffold` は `scenario-observations` の実測値を作らない。代わりに `scenarioObservationsTemplate` を返し、benchmark や incident review から埋める前提を明示する。

### telemetry / pattern runtime input

`CommonOps`:

1. `telemetry-observations`
2. `telemetry-raw-observations + telemetry-normalization-profile`
3. `telemetry-export`
4. `telemetry-source`

`PatternRuntime`:

1. `pattern-runtime-observations`
2. `pattern-runtime-raw-observations + pattern-runtime-normalization-profile`
3. telemetry export 内の pattern runtime
4. `TIS` bridge

### delivery / complexity input

`Delivery`:

1. `delivery-observations`
2. `delivery-raw-observations + delivery-normalization-profile`
3. `delivery-export`
4. `delivery-source`

`CTI`:

1. `complexity-export`
2. `complexity-source`
3. constraints metadata と codebase-derived proxy

このリポジトリの self-measurement bundle では、運用 metadata を `architecture-constraints.yaml` に持たず、curated な `architecture-complexity-snapshot.yaml` から canonical な `complexity-export` file を再生成して渡します。

direct file 入力は canonical 形式だけでなく、collector が自然に出す要約形式も load 時に正規化します。

- `scenario-observations`: canonical observation set に加え、benchmark / incident review summary を受理
- `constraints.scaffold`: `scenarioObservationsTemplate` を返すが、実測値は生成しない
- `delivery-export`: canonical export bundle に加え、DORA summary や `contextProbe.exportBundle` を内包する rich document を受理
- `delivery-export` を `delivery-normalization-profile` なしで使う場合は、canonical export ingestion 側で built-in の DORA normalization defaults を適用する。明示的な raw delivery input は引き続き normalization profile 必須
- `complexity-export`: canonical export bundle に加え、raw complexity snapshot や `contextProbe.exportBundle` を内包する rich document を受理

### contract baseline input

1. `contract-baseline`
2. `contract-baseline-source`
3. それ以外は `CBC` / `BCR` が current-state proxy のままになる

## Metric ごとの主入力

| Metric | 主入力 | current implementation 上の注意 |
|---|---|---|
| `QSF` | scenario catalog、observations | 正規化済み scenario observation に依存 |
| `DDS` | repo、constraints | 静的で直接的 |
| `BPS` | repo、constraints | 静的で直接的 |
| `IPS` | repo、constraints、optional な contract baseline | 静的。contract baseline があると `CBC` / `BCR` は baseline 差分で読む |
| `TIS` | topology model、runtime observations | 明示 bridge signal として扱う |
| `OAS` | telemetry、pattern runtime、`TIS` bridge | normalization と fallback を含み得る |
| `AELS` | Git 履歴、boundary map または constraint layers | boundary map 不在時は proxy を使う |
| `EES` | delivery input、`AELS` | delivery と locality を合成する |
| `CTI` | complexity metadata、export、codebase count | metadata が薄いと partial になりやすい |
| `APSI` | 上記 supporting metrics | summary-only で profile 重み付き |

locality scoring のための `git log` は、明示的な boundary map があればその globs に、なければ constraint layer の globs に絞って収集する。

## Report と Gate での扱い

current report:

- `APSI` は summary section に分離表示する
- bridge metric より supporting metrics を先に読む前提にする
- proxy / partial signal は `unknowns` で可視化する

current gate:

- active profile の threshold を使う
- `APSI` は summary-only として扱い、単独で architecture fail の主判定にしない
- supporting metrics を主な gate input とする

## 関連文書

- 共有ランタイム契約: [runtime-and-commands.ja.md](runtime-and-commands.ja.md)
- アーキテクチャ設計指標の意味: [../reference/architecture-design-metrics.ja.md](../reference/architecture-design-metrics.ja.md)
- policy と CI: [../operations/policy-and-ci.ja.md](../operations/policy-and-ci.ja.md)
- source collector: [../operations/architecture-source-collectors.ja.md](../operations/architecture-source-collectors.ja.md)
