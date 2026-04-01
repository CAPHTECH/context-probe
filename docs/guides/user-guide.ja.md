# ユーザーズガイド

このガイドは、初回利用者が `context-probe` の CLI をローカルで起動し、代表的な計測を 1 回実行して、結果の読み方と次の導線を理解するための最短ルートです。

詳細仕様の読み込みより先に、まず「どう使い始めるか」を押さえることを目的にしています。

既存 repo へ `context-probe` を適用したい場合は、先に [repo-apply-playbook.ja.md](repo-apply-playbook.ja.md) を読んでください。このガイドは初回の成功体験と、その次の判断に絞っています。

## これは何か

`context-probe` は、AI と決定的な解析器を組み合わせて設計品質を計測する CLI です。

- AI は、文書から用語、ルール、不変条件などの証拠候補を抽出します
- 決定的解析は、依存関係、境界違反、履歴、スコア計算を再現可能な形で処理します
- 出力には `evidence` `confidence` `unknowns` `provenance` が含まれます

最初に触るコマンドは、主に次の 4 つです。

- `score.compute`
- `report.generate`
- `gate.evaluate`
- `review.list_unknowns`

## 目的別の入口

今の目的ごとに、最短の導線を使い分けます。

- 最初の 1 回を成功させたい: このガイドを続ける
- 既存 repo に `context-probe` を適用したい: [repo-apply-playbook.ja.md](repo-apply-playbook.ja.md)
- このリポジトリの self-measurement を運用したい: [../operations/self-measurement-runbook.ja.md](../operations/self-measurement-runbook.ja.md)

## 始める前に

前提:

- Node.js 24 以上
- このリポジトリをローカルに clone 済み

セットアップ:

```bash
npm install
npm run build
npm run dev -- --help
```

`npm run dev -- --help` を実行すると、現在利用できるコマンド一覧が JSON で表示されます。ガイド中のコマンド名は、この一覧にあるものだけを使っています。

以降の例では、リポジトリ直下で `npm run dev -- ...` を使います。

モデルや制約ファイルがまだない場合は、先に scaffold を作れます。

```bash
npm run dev -- model.scaffold \
  --repo . \
  --docs-root docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo .
```

どちらも `result.yaml` にレビュー用の YAML 文字列を返します。CLI はファイルを自動生成しないので、必要ならその内容を保存して `score.compute` に渡します。

`constraints.scaffold` は `result.drafts` に `scenarioObservationsTemplate` `scenarioCatalog` `topologyModel` `boundaryMap` の starter draft も返します。`scenarioObservationsTemplate` は観測値ではなく review 用のテンプレートで、benchmark や incident review から埋める前提です。docs-first な repo では、初回のスコアリング前に architecture 入力を用意する叩き台として使えます。

このガイドでは次の境界を統一して使います。

- scaffold 出力: review-first draft
- starter run: 方向と unknowns を見るための実行
- authoritative run: curated input と observation snapshot を前提にした本命の実行

repo 適用の全体フローが必要なら [repo-apply-playbook.ja.md](repo-apply-playbook.ja.md) を使います。

## 最初の 10 分

まずはドメイン設計のスコアを 1 回出して、出力の形を確認します。

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml
```

このコマンドで分かること:

- `domain_design` 向けの主要メトリクスが計算される
- 共通レスポンスとして `status` `result` `evidence` `confidence` `unknowns` `diagnostics` `provenance` が返る
- 初回利用時でも、どの根拠で計測したかを JSON で追える

文書も含めて計測したい場合は、`--docs-root docs` を追加します。

`domain_design` では、次を足すと結果が改善しやすくなります。

- `domain-model.yaml` の explicit aggregate
- `--docs-root` で取れる docs coverage
- locality 系に効く十分な git history

主に `AFS` `BFS` と history 依存部分に効きます。

## 目的別コマンドマップ

| 目的 | コマンド |
| --- | --- |
| 最初の入力を scaffold する | `model.scaffold`, `constraints.scaffold` |
| 最初の assessment を回す | `score.compute`, `report.generate`, `gate.evaluate` |
| まだ review が必要な箇所を見る | `review.list_unknowns` |
| 文書からの抽出証拠を確認する | `doc.extract_*` |
| model/code や term/code の linking を確認する | `trace.link_model_to_code`, `trace.link_terms` |
| locality や history の証拠を確認する | `history.*` |
| 高度な rollout と運用 | shadow rollout commands, self-measurement runbook |

実装レベルのコマンド契約が必要なときは、[../implementation/runtime-and-commands.ja.md](../implementation/runtime-and-commands.ja.md) を参照します。

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

## 代表ワークフロー

### 1. アーキテクチャ設計を計測する

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo fixtures/architecture/sample-repo \
  --constraints fixtures/architecture/constraints.yaml \
  --policy fixtures/policies/default.yaml
```

この系統では `--model` ではなく `--constraints` が必須です。

このコマンドだけでも動きますが、`QSF` `TIS` `OAS` `EES` を neutral / proxy ではなく観測付きで読みたい場合は、scenario / topology / runtime / telemetry / delivery の入力も渡します。`scenario-observations` は scaffold で捏造せず、benchmark や incident review から作ります。

実務上は、次の順で architecture 結果が改善しやすいです。

- `scenario-observations` は `QSF` を改善する
- `contract-baseline` は `IPS` を改善する
- `runtime-observations` は `TIS` を改善する
- `pattern-runtime-observations` と `telemetry-observations` は `OAS` を改善する
- `delivery-observations` または delivery export は `EES` を改善する

別 repo に適用するときの具体的な手順は [repo-apply-playbook.ja.md](repo-apply-playbook.ja.md) にまとめています。

このリポジトリ自身を測るときの最小セットは `config/self-measurement/` に置いてあります。

architecture の full self-measurement bundle を回す前に、measured / derived snapshot を更新します。

```bash
npm run self:architecture:refresh
```

意図的に固定する `IPS` contract baseline は別コマンドで capture します。

```bash
npm run self:architecture:baseline
```

snapshot を書き換えずに鮮度だけ確認したい場合は次を使います。

```bash
npm run self:architecture:audit
```

advisory audit と architecture score smoke をまとめて回す運用チェックは次です。

```bash
npm run self:architecture:check
```

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --complexity-export config/self-measurement/architecture-complexity-export.yaml \
  --boundary-map config/self-measurement/architecture-boundary-map.yaml \
  --contract-baseline config/self-measurement/architecture-contract-baseline.yaml \
  --scenario-catalog config/self-measurement/architecture-scenarios.yaml \
  --scenario-observations config/self-measurement/architecture-scenario-observations.yaml \
  --topology-model config/self-measurement/architecture-topology.yaml \
  --runtime-observations config/self-measurement/architecture-runtime-observations.yaml \
  --telemetry-observations config/self-measurement/architecture-telemetry-observations.yaml \
  --pattern-runtime-observations config/self-measurement/architecture-pattern-runtime-observations.yaml \
  --delivery-observations config/self-measurement/architecture-delivery-observations.yaml \
  --policy fixtures/policies/default.yaml
```

ここで使っている architecture 入力は live collector ではなく reviewable snapshot です。`scenario-observations` はローカル benchmark か incident review から作り、`constraints.scaffold` が返す `scenarioObservationsTemplate` はその入力を埋めるための review 用テンプレートとして扱います。`telemetry` `pattern runtime` `delivery` と raw な `architecture-complexity-snapshot.yaml` は maintainers が更新する curated observation として扱います。`complexity-export` はその complexity snapshot から生成する derived artifact です。`npm run self:architecture:refresh` は measured な `scenario-observations` と derived な `boundary-map` を更新し、`npm run self:architecture:complexity` は curated な complexity snapshot から `architecture-complexity-export.yaml` を再生成します。`npm run self:architecture:baseline` は current contract surface を reviewable な `IPS` baseline として capture するための別導線で、baseline delta を保つため `refresh` には含めません。`npm run self:architecture:audit` はその advisory 版で、CI に載せる用途を想定しています。`npm run self:architecture:check` は、その advisory audit と architecture score smoke をまとめた運用チェックです。

日常運用では次の順を基本にします。

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # IPS の比較基準を意図的に更新したいときだけ
npm run self:architecture:check
```

CI と同じ品質ゲートをローカルで確認したい場合は次を使います。

```bash
npm run test:coverage
```

安定した運用順序は [docs/operations/self-measurement-runbook.ja.md](../operations/self-measurement-runbook.ja.md) にまとめています。

このリポジトリでは small CLI codebase という性質上、`ALR` `FCC` `SICR` `SLA` は evidence-limited の unknown が残りやすく、`PCS` も proxy composite のままです。これは自己計測の limitation として読みます。

### 2. Markdown レポートを生成する

計測結果を読みやすい Markdown にしたい場合は `report.generate` を使います。

```bash
npm run dev -- report.generate \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --format md
```

`result.report` に Markdown 文字列が入り、メトリクス、`confidence`、`unknowns`、`diagnostics` を人間向けに確認できます。
最近の report には `Measurement Quality` `Suggested Next Evidence` `Action Queue` も入ります。`architecture_design` では入力が揃っていれば `Scenario Quality` と `Locality Watchlist` も出ます。

### 3. ゲート判定を確認する

ポリシー閾値に対する判定だけを見たい場合は `gate.evaluate` を使います。

```bash
npm run dev -- gate.evaluate \
  --domain architecture_design \
  --repo fixtures/architecture/sample-repo \
  --constraints fixtures/architecture/constraints.yaml \
  --policy fixtures/policies/default.yaml
```

ここでは主に次を見ます。

- `status`: 全体判定
- `result.gate.failures`: fail 条件に入った項目
- `result.gate.warnings`: warn 条件に入った項目

`gate.evaluate` `report.generate` `review.list_unknowns` は、`score.compute` が返す additive な `meta.measurementQuality` をそのまま再利用します。unknown / proxy の圧力を surface ごとに別解釈しないためです。

### 4. 人手確認が必要な項目を出す

`unknowns` や低 confidence を review 用に見たい場合は、次のコマンドを使います。

```bash
npm run dev -- review.list_unknowns \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root docs
```

### 5. ローカル限定の command analytics を見る

repo-local な command usage analytics が欲しいときだけ、明示的に opt-in します。

```bash
export CONTEXT_PROBE_EVENT_LOG="$PWD/.context-probe-events.jsonl"
npm run dev -- score.compute --repo . --model config/self-measurement/domain-model.yaml --policy fixtures/policies/default.yaml --domain domain_design
npm run analytics:summarize -- --input "$CONTEXT_PROBE_EVENT_LOG"
```

この logging はローカル限定です。command、duration、confidence、unknown count、proxy rate、同一 session 内で report/review が続いたかを記録します。remote collection は行いません。

### 6. 上級: application 向け persistence pilot を実行する

curated な shadow-rollout gate で `application` category が `replace` になっている場合は、主導線の report / gate surface からそのまま pilot を実行できます。

pilot report の例:

```bash
npm run dev -- report.generate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --format md \
  --pilot-persistence \
  --rollout-category application \
  --shadow-rollout-registry fixtures/validation/shadow-rollout/registry.yaml
```

pilot gate の例:

```bash
npm run dev -- gate.evaluate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --pilot-persistence \
  --rollout-category application \
  --shadow-rollout-registry fixtures/validation/shadow-rollout/registry.yaml
```

pilot mode で変わる点:

- `score.compute` は shadow payload を引き続き計算します
- `result.pilot` に baseline `ELS`、persistence candidate、実効 locality source、gate 状態が入ります
- 実効 `ELS` が変わるのは、選択した category gate が現在 `replace` のときだけです
- 現在の curated gate では `tooling` はまだ `shadow_only` のままです

## 結果の読み方

共通レスポンスの見る順番は次の通りです。

### `status`

- `ok`: 実行は成功し、重大な警告も少ない状態です
- `warning`: 実行自体はできたが、注意点や未確定事項があります
- `error`: 必須引数不足、例外、またはゲート fail などで成功扱いにできない状態です

### `confidence`

結果の確からしさです。低いほど、人手確認が必要な可能性が上がります。

### `unknowns`

まだ確定できていない事項です。`status` が `ok` でも空とは限りません。初回利用時は、ここに「何が足りないか」が出ることがあります。

### `diagnostics`

実行時の補足情報です。fallback 利用や補助的な注意点がここに出ます。

### `provenance`

どの入力や設定を使ったかを示す追跡情報です。結果の出どころを後から確認するときに使います。

## よくある詰まりどころ

### `--model` と `--constraints` を取り違える

- `domain_design` では `--model` が必須です
- `architecture_design` では `--constraints` が必須です

### `--docs-root` を付けていない

ドメイン設計の `score.compute` は `--docs-root` なしでも動きますが、文書起点のメトリクスはスキップされます。`unknowns` にその旨が出たら、まず `--docs-root` を確認してください。

### Git 履歴が足りない

履歴系の評価は Git 情報に依存します。履歴が未初期化、または少なすぎる場合は、`ELS` などの confidence が下がったり、`unknowns` に注意が出たりします。

### architecture self-measurement に補助入力を付けていない

`architecture_design` は `--constraints` だけでも動きますが、その場合 `QSF` `TIS` `OAS` `EES` が未観測や bridge fallback になりやすいです。自己計測で proxy を減らしたいなら、`config/self-measurement/architecture-*.yaml` を一緒に渡してください。

### `doc.extract_*` を最初から使おうとする

`doc.extract_glossary` などは有用ですが、`--extractor cli` と provider CLI の前提が入るため、初回利用の主導線には向きません。まずは `score.compute` と `report.generate` で全体像をつかむのがおすすめです。

## 次に読む文書

使い始めた後は、目的に応じて次の文書へ進んでください。

- 実行パイプラインとコマンド体系: [../implementation/runtime-and-commands.ja.md](../implementation/runtime-and-commands.ja.md)
- 指標の共通の読み方: [../reference/metric-reading-guide.ja.md](../reference/metric-reading-guide.ja.md)
- ドメイン設計指標の意味: [../reference/domain-design-metrics.ja.md](../reference/domain-design-metrics.ja.md)
- アーキテクチャ設計指標の意味: [../reference/architecture-design-metrics.ja.md](../reference/architecture-design-metrics.ja.md)
- ドメイン設計の current implementation: [../implementation/domain-design-measurement.ja.md](../implementation/domain-design-measurement.ja.md)
- アーキテクチャ設計の current implementation: [../implementation/architecture-design-measurement.ja.md](../implementation/architecture-design-measurement.ja.md)
- 標準データモデル: [../concepts/data-model.ja.md](../concepts/data-model.ja.md)
- ポリシー設定と CI 運用: [../operations/policy-and-ci.ja.md](../operations/policy-and-ci.ja.md)
- release 前チェックリスト: [../operations/release-preflight.ja.md](../operations/release-preflight.ja.md)
- source config と collector の詳細: [../operations/architecture-source-collectors.ja.md](../operations/architecture-source-collectors.ja.md)
- 文書全体の索引: [../README.ja.md](../README.ja.md)
