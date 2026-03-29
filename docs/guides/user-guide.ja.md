# ユーザーズガイド

このガイドは、初回利用者が `context-probe` の CLI をローカルで起動し、代表的な計測を 1 回実行して、結果の読み方と次の導線を理解するための最短ルートです。

詳細仕様の読み込みより先に、まず「どう使い始めるか」を押さえることを目的にしています。

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

### 5. 上級: application 向け persistence pilot を実行する

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
- source config と collector の詳細: [../operations/architecture-source-collectors.ja.md](../operations/architecture-source-collectors.ja.md)
- 文書全体の索引: [../README.ja.md](../README.ja.md)
