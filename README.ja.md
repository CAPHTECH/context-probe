# AI支援設計計測プラットフォーム

English version: [README.md](README.md)

AIと決定的な解析器を組み合わせて、設計品質を証拠ベースで計測するための docs-first リポジトリです。現時点ではドメイン設計評価とアーキテクチャ設計評価を中心に実装しており、将来的な評価パック拡張も同じ計測モデルの上に載せられるよう文書を整理しています。

日本語文書を正本とし、英語文書は同じ構成と文書責務を保つ追従版として管理します。

## 読み始め

1. [docs/README.ja.md](docs/README.ja.md)
2. [docs/guides/user-guide.ja.md](docs/guides/user-guide.ja.md)
3. [docs/concepts/measurement-model.ja.md](docs/concepts/measurement-model.ja.md)
4. [docs/reference/domain-design-metrics.ja.md](docs/reference/domain-design-metrics.ja.md)
5. [docs/reference/architecture-design-metrics.ja.md](docs/reference/architecture-design-metrics.ja.md)
6. [docs/implementation/runtime-and-commands.ja.md](docs/implementation/runtime-and-commands.ja.md)
7. [docs/roadmap/phased-delivery.ja.md](docs/roadmap/phased-delivery.ja.md)

## 文書構成

- [docs/README.ja.md](docs/README.ja.md): 文書全体の索引
- [docs/guides/user-guide.ja.md](docs/guides/user-guide.ja.md): 初回利用者向けの最短ガイド
- [docs/concepts/](docs/concepts): 概念仕様と計測モデル
- [docs/reference/](docs/reference): 指標と summary score の読み方
- [docs/implementation/](docs/implementation): current implementation の計算経路と出力契約
- [docs/operations/](docs/operations): policy、CI、collector 運用
- [docs/roadmap/](docs/roadmap): 段階的導入計画と実験メモ

## 最初に覚えるコマンド

- `score.compute`
- `report.generate`
- `gate.evaluate`
- `review.list_unknowns`

## 中核原則

- AIは採点者ではなく、証拠抽出器と曖昧性整理器として使う
- スコアは固定式と決定的解析で算出する
- すべての指標に `evidence` `confidence` `unknowns` `provenance` を付ける
- 組織横断の絶対評価より、候補比較と時系列比較を重視する
- 評価領域ごとの差分は、共通基盤の上に載る拡張パックとして扱う

## 実装状況

- CLI中心の TypeScript / Node 実装を追加済み
- Phase 1 相当として、依存解析、境界漏れ検出、進化局所性、スコア計算、レポート、ゲート判定を実装済み
- Phase 2 の入口として、`doc.extract_*` の external CLI extractor、`trace.*` の証拠付きリンク生成、`review.resolve` の review log 化を追加済み
- 将来拡張向けに `domain_design` と `architecture_design` の pack 境界を追加済み

## クイックスタート

最初に CLI の使い方を追いたい場合は、[docs/guides/user-guide.ja.md](docs/guides/user-guide.ja.md) を先に読むのが最短です。

```bash
npm install
npm run dev -- --help
```

公開済みパッケージの入口をそのまま試す場合は次を使います。

```bash
npx context-probe --help
```

ビルド済み CLI も確認したい場合は次を使います。

```bash
npm run build
node dist/src/cli.js --help
```

### 先に入力 YAML を scaffold する

まだ `--model` や `--constraints` を持っていない場合は、先に scaffold を作り、`result.yaml` をレビューします。

```bash
npm run dev -- model.scaffold \
  --repo . \
  --docs-root docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo .
```

### ドメイン設計スコアの計測例

```bash
npm run dev -- score.compute \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

文書起点の metric も含めたい場合は `--docs-root docs` を追加します。

### Markdown レポートの生成例

```bash
npm run dev -- report.generate \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design \
  --format md
```

### アーキテクチャ設計スコアの計測例

```bash
npm run dev -- score.compute \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --domain architecture_design
```

アーキテクチャ設計では `--model` ではなく `--constraints` が必須です。

自己計測で `QSF` `TIS` `OAS` `EES` の proxy を減らしたい場合は、`config/self-measurement/` の補助入力も一緒に渡します。

architecture の自己計測前には、measured / derived snapshot を先に更新します。

```bash
npm run self:architecture:refresh
```

意図的に固定する `IPS` contract baseline は別コマンドで capture します。

```bash
npm run self:architecture:baseline
```

snapshot の鮮度だけを advisory に確認したい場合は次を使います。

```bash
npm run self:architecture:audit
```

advisory audit と score smoke をまとめて確認したい場合は次を使います。

```bash
npm run self:architecture:check
```

release 前の validation と packaging は [docs/operations/release-preflight.ja.md](docs/operations/release-preflight.ja.md) を参照してください。

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

これらは live collector ではなく reviewable snapshot です。`scenario-observations` はローカル benchmark から作り、`telemetry` `pattern runtime` `delivery` と raw な `architecture-complexity-snapshot.yaml` は curated observation として管理します。`complexity-export` はその complexity snapshot から作る derived artifact です。`npm run self:architecture:refresh` は measured な `scenario-observations` と derived な `boundary-map` を更新し、`npm run self:architecture:complexity` は curated な complexity snapshot から `architecture-complexity-export.yaml` を再生成します。`npm run self:architecture:baseline` は current contract surface を reviewable な `IPS` baseline として capture するための別導線で、baseline delta を保つため `refresh` には含めません。`npm run self:architecture:audit` は CI に載せやすい advisory check で、`npm run self:architecture:check` はその audit と score smoke をまとめて行う運用チェックです。

日常運用では次の順を基本にします。

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # IPS の比較基準を意図的に更新したいときだけ
npm run self:architecture:check
```

coverage も品質ゲートに含めます。

```bash
npm run test:coverage
```

運用順序の要約は [docs/operations/self-measurement-runbook.ja.md](docs/operations/self-measurement-runbook.ja.md) にまとめています。

このリポジトリ固有の注意として、small CLI codebase なので `ALR` `FCC` `SICR` `SLA` は evidence-limited のまま残りやすく、`PCS` も proxy composite のままです。これらは直ちに不具合を示すというより、自己計測の limitation として読みます。

### source config を使った brownfield evidence の取り込み例

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo fixtures/validation/scoring/qsf/repo \
  --constraints fixtures/validation/scoring/qsf/constraints.yaml \
  --policy fixtures/policies/default.yaml \
  --contract-baseline-source fixtures/examples/architecture-sources/contract-baseline-source.file.yaml \
  --scenario-catalog fixtures/validation/scoring/qsf/scenarios.yaml \
  --scenario-observation-source fixtures/examples/architecture-sources/scenario-observation-source.command.yaml \
  --telemetry-source fixtures/examples/architecture-sources/telemetry-source.command.yaml \
  --telemetry-normalization-profile fixtures/validation/scoring/oas/raw-normalization-profile.yaml \
  --complexity-source fixtures/examples/architecture-sources/complexity-source.command.yaml \
  --profile layered
```

collector と source config の詳細は [docs/operations/architecture-source-collectors.ja.md](docs/operations/architecture-source-collectors.ja.md) にまとめています。

### 人間レビューが必要な unknowns を一覧する例

```bash
npm run dev -- review.list_unknowns \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --domain domain_design
```

### 高度な例: Codex CLI を使った用語抽出

```bash
npm run dev -- doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider codex
```

### 高度な例: Review log を適用した再抽出

```bash
npm run dev -- doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider claude \
  --review-log path/to/review-log.json \
  --apply-review-log
```

## このプロジェクト自身を計測する

自己計測用の最小定義は [config/self-measurement/domain-model.yaml](config/self-measurement/domain-model.yaml)、[config/self-measurement/architecture-constraints.yaml](config/self-measurement/architecture-constraints.yaml)、[config/self-measurement/architecture-complexity-snapshot.yaml](config/self-measurement/architecture-complexity-snapshot.yaml)、[config/self-measurement/architecture-complexity-export.yaml](config/self-measurement/architecture-complexity-export.yaml) に置いています。

### 1. Git 履歴を有効化する

`ELS` は Git 履歴を参照するため、未初期化の環境では warning と低 confidence になります。ローカルでまだ Git を初期化していない場合は次を実行します。

```bash
git init
git add .
git -c user.name="Context Probe" -c user.email="context-probe@example.com" commit -m "chore: initialize context-probe"
```

### 2. ドメイン設計スコアを出す

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

### 3. アーキテクチャ設計スコアを出す

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --complexity-export config/self-measurement/architecture-complexity-export.yaml \
  --boundary-map config/self-measurement/architecture-boundary-map.yaml \
  --scenario-catalog config/self-measurement/architecture-scenarios.yaml \
  --scenario-observations config/self-measurement/architecture-scenario-observations.yaml \
  --topology-model config/self-measurement/architecture-topology.yaml \
  --runtime-observations config/self-measurement/architecture-runtime-observations.yaml \
  --telemetry-observations config/self-measurement/architecture-telemetry-observations.yaml \
  --pattern-runtime-observations config/self-measurement/architecture-pattern-runtime-observations.yaml \
  --delivery-observations config/self-measurement/architecture-delivery-observations.yaml \
  --policy fixtures/policies/default.yaml
```

補助入力を省略すると architecture 側は neutral / proxy fallback が増えるため、自己計測では上のフルセットを基準にしてください。

### 4. Markdown レポートを生成する

```bash
npm run dev -- report.generate \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --format md
```

## 検証

```bash
npm run check
npm test
```

`npm test` には `fixtures/validation/extraction/` の curated golden corpus を使った抽出品質検証も含まれます。ここでは `doc.extract_*` `trace.link_terms` `review.list_unknowns` を既存CLIのまま叩き、`must_include` `must_exclude` `must_link_to_code` `max_review_items` で回帰を検知します。
