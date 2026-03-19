# AI支援設計計測プラットフォーム

AIと決定的な解析器を組み合わせて、設計品質を証拠ベースで計測するための docs-first リポジトリです。現時点ではドメイン設計評価を最初の評価領域として扱い、将来的にはアーキテクチャ設計、運用設計、セキュリティ設計などへ拡張できる前提で文書を整理しています。

## 読み始め

1. [docs/overview/platform-vision.md](docs/overview/platform-vision.md)
2. [docs/platform/measurement-model.md](docs/platform/measurement-model.md)
3. [docs/domains/domain-design.md](docs/domains/domain-design.md)
4. [docs/roadmap/phased-delivery.md](docs/roadmap/phased-delivery.md)

## 文書構成

- [docs/README.md](docs/README.md): 文書全体の索引
- [docs/overview/platform-vision.md](docs/overview/platform-vision.md): プラットフォーム全体のVisionと対象範囲
- [docs/platform/measurement-model.md](docs/platform/measurement-model.md): 共通計測モデルと評価領域拡張の前提
- [docs/platform/runtime-and-commands.md](docs/platform/runtime-and-commands.md): 実行パイプラインとコマンド体系
- [docs/platform/data-model.md](docs/platform/data-model.md): 標準データモデルと出力契約
- [docs/domains/domain-design.md](docs/domains/domain-design.md): ドメイン設計評価の詳細仕様
- [docs/domains/architecture-design.md](docs/domains/architecture-design.md): 将来拡張としてのアーキテクチャ設計評価案
- [docs/operations/policy-and-ci.md](docs/operations/policy-and-ci.md): ポリシー設定、CI、レビュー運用
- [docs/roadmap/phased-delivery.md](docs/roadmap/phased-delivery.md): 段階的導入計画

## 中核原則

- AIは採点者ではなく、証拠抽出器と曖昧性整理器として使う
- スコアは固定式と決定的解析で算出する
- すべての指標に `evidence` `confidence` `unknowns` `provenance` を付ける
- 組織横断の絶対評価より、候補比較と時系列比較を重視する
- 評価領域ごとの違いは、共通基盤の上に載る拡張パックとして扱う

## 実装状況

- CLI中心の TypeScript / Node 実装を追加済み
- Phase 1 相当として、依存解析、境界漏れ検出、進化局所性、スコア計算、レポート、ゲート判定を実装済み
- Phase 2 の入口として、`doc.extract_*` の external CLI extractor、`trace.*` の証拠付きリンク生成、`review.resolve` の review log 化を追加済み
- 将来拡張向けに `domain_design` と `architecture_design` の pack 境界を追加済み

## クイックスタート

```bash
npm install
npm run build
node dist/src/cli.js --help
```

### ドメイン設計スコアの計測例

```bash
node dist/src/cli.js score.compute \
  --domain domain_design \
  --repo fixtures/domain-design/sample-repo \
  --model fixtures/domain-design/model.yaml \
  --policy fixtures/policies/default.yaml
```

### アーキテクチャ依存方向の計測例

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo fixtures/architecture/sample-repo \
  --constraints fixtures/architecture/constraints.yaml \
  --policy fixtures/policies/default.yaml
```

### Codex CLI を使った用語抽出例

```bash
node dist/src/cli.js doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider codex
```

### Review log を適用した再抽出例

```bash
node dist/src/cli.js doc.extract_glossary \
  --docs-root docs \
  --extractor cli \
  --provider claude \
  --review-log path/to/review-log.json \
  --apply-review-log
```

## このプロジェクト自身を計測する

自己計測用の最小定義は [config/self-measurement/domain-model.yaml](config/self-measurement/domain-model.yaml) と [config/self-measurement/architecture-constraints.yaml](config/self-measurement/architecture-constraints.yaml) に置いています。

### 1. Git 履歴を有効化する

`ELS` は Git 履歴を参照するため、未初期化の環境では warning と低 confidence になります。ローカルでまだ Git を初期化していない場合は次を実行します。

```bash
git init
git add .
git -c user.name="Context Probe" -c user.email="context-probe@example.com" commit -m "chore: initialize context-probe"
```

### 2. ドメイン設計スコアを出す

```bash
node dist/src/cli.js score.compute \
  --domain domain_design \
  --repo . \
  --model config/self-measurement/domain-model.yaml \
  --policy fixtures/policies/default.yaml
```

### 3. アーキテクチャ設計スコアを出す

```bash
node dist/src/cli.js score.compute \
  --domain architecture_design \
  --repo . \
  --constraints config/self-measurement/architecture-constraints.yaml \
  --policy fixtures/policies/default.yaml
```

### 4. Markdown レポートを生成する

```bash
node dist/src/cli.js report.generate \
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
