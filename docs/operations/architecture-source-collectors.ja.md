# アーキテクチャ source collector ガイド

- 文書版数: v0.1
- 目的: canonical source config を実運用の export / snapshot / review へ接続するための reference collector を定義する

## 1. 位置づけ

`architecture_design` の brownfield evidence は、core が vendor API を直接読むのではなく、
collector が canonical JSON を stdout または file へ出し、それを `--*-source` から読む形で接続する。

このリポジトリに含まれる collector は reference implementation であり、vendor 固有の認証や API 呼び出しは持たない。
実運用では外部 script / CI job / export pipeline が同じ canonical schema を出せばよい。

## 2. 同梱 collector

### `telemetry-export-to-oas.mjs`

- 入力: golden signals 系 summary
- 出力: `ArchitectureTelemetryExportBundle`
- 目的: traffic band ごとの latency / errors / saturation と、optional な embedded `PatternRuntime` を `OAS` の入力へ落とす

### `delivery-export-to-ees.mjs`

- 入力: DORA / deploy history summary
- 出力: `ArchitectureDeliveryExportBundle`
- 目的: lead time / deploy frequency / recovery time / change fail rate / rework rate を `EES` の delivery 側へ落とす

### `complexity-snapshot-to-cti.mjs`

- 入力: team / deployable / pipeline / on-call / cost snapshot
- 出力: `ArchitectureComplexityExportBundle`
- 目的: `CTI` の operational metadata を canonical shape に揃える
- self-measurement では curated な raw snapshot を `config/self-measurement/architecture-complexity-snapshot.yaml` に置き、`npm run self:architecture:complexity` で `architecture-complexity-export.yaml` を再生成する

### `scenario-actualization-to-qsf.mjs`

- 入力: benchmark summary または incident review summary
- 出力: `ScenarioObservationSet`
- 目的: raw telemetry や incident review を直接 `QSF` に入れず、scenario 単位へ要約してから使う

### `IPS` contract baseline

- 入力: review 済み contract baseline snapshot
- 出力: `ArchitectureContractBaseline`
- 目的: `CBC` `BCR` を current-state proxy ではなく baseline 差分で読む

## 3. source config の使い方

command source の最小形は次です。

```yaml
version: "1.0"
sourceType: "command"
cwd: "../../.."
command: "node scripts/collectors/architecture/telemetry-export-to-oas.mjs fixtures/examples/architecture-sources/telemetry-golden-signals.json"
```

example config は次に置いています。

- [telemetry-source.command.yaml](../../fixtures/examples/architecture-sources/telemetry-source.command.yaml)
- [delivery-source.command.yaml](../../fixtures/examples/architecture-sources/delivery-source.command.yaml)
- [complexity-source.command.yaml](../../fixtures/examples/architecture-sources/complexity-source.command.yaml)
- [scenario-observation-source.command.yaml](../../fixtures/examples/architecture-sources/scenario-observation-source.command.yaml)
- [contract-baseline-source.file.yaml](../../fixtures/examples/architecture-sources/contract-baseline-source.file.yaml)

## 4. example input fixture

collector 入力の example は次に置いています。

- [telemetry-golden-signals.json](../../fixtures/examples/architecture-sources/telemetry-golden-signals.json)
- [delivery-dora-summary.json](../../fixtures/examples/architecture-sources/delivery-dora-summary.json)
- [complexity-snapshot.json](../../fixtures/examples/architecture-sources/complexity-snapshot.json)
- [scenario-benchmark-summary.json](../../fixtures/examples/architecture-sources/scenario-benchmark-summary.json)
- [scenario-incident-review-summary.json](../../fixtures/examples/architecture-sources/scenario-incident-review-summary.json)
- [contract-baseline.yaml](../../fixtures/examples/architecture-sources/contract-baseline.yaml)

## 5. score.compute での利用例

### OAS

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/tis/repo \
  --constraints fixtures/validation/scoring/tis/constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --telemetry-source fixtures/examples/architecture-sources/telemetry-source.command.yaml \
  --telemetry-normalization-profile fixtures/validation/scoring/oas/raw-normalization-profile.yaml
```

### EES

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo <git-backed-repo> \
  --constraints fixtures/validation/scoring/ees/constraints.yaml \
  --boundary-map fixtures/validation/scoring/ees/boundary-map.yaml \
  --policy fixtures/policies/default.yaml \
  --delivery-source fixtures/examples/architecture-sources/delivery-source.command.yaml \
  --delivery-normalization-profile fixtures/validation/scoring/ees/raw-normalization-profile.yaml
```

### CTI

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/cti/good-repo \
  --constraints fixtures/validation/scoring/cti/good-constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --complexity-source fixtures/examples/architecture-sources/complexity-source.command.yaml
```

### QSF

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/qsf/repo \
  --constraints fixtures/validation/scoring/qsf/constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --scenario-catalog fixtures/validation/scoring/qsf/scenarios.yaml \
  --scenario-observation-source fixtures/examples/architecture-sources/scenario-observation-source.command.yaml
```

### IPS

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/ips/good-repo \
  --constraints fixtures/validation/scoring/ips/constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --contract-baseline-source fixtures/examples/architecture-sources/contract-baseline-source.file.yaml
```

## 6. profile scorecard の使い方

同じ evidence source を使ったまま `--profile` だけを切り替えることで、比較観点だけを変えられる。

```bash
node dist/src/cli.js score.compute ... --profile layered
node dist/src/cli.js score.compute ... --profile service_based
node dist/src/cli.js score.compute ... --profile cqrs
node dist/src/cli.js score.compute ... --profile event_driven
```

このとき変わるのは `APSI` の比較重みだけで、supporting metrics 自体の計算式は変わらない。
