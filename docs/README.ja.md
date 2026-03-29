# 文書索引

このリポジトリの文書は、次の 3 つの責務に分けて整理しています。

- `concepts/`: 何を計測したいか
- `reference/`: 指標を人間がどう読むか
- `implementation/`: current implementation が実際にどう計算しているか

日本語版を正本とし、英語版は同じ構成と文書責務を保つ追従版として管理します。

## 最初の導線

目的ごとに次の入口から読むのが最短です。

1. CLI を使い始める: [guides/user-guide.ja.md](guides/user-guide.ja.md)
2. `score` `confidence` `unknowns` の読み方を知る: [reference/metric-reading-guide.ja.md](reference/metric-reading-guide.ja.md)
3. ドメイン設計の指標を読む: [reference/domain-design-metrics.ja.md](reference/domain-design-metrics.ja.md)
4. アーキテクチャ設計の指標を読む: [reference/architecture-design-metrics.ja.md](reference/architecture-design-metrics.ja.md)
5. 現行の実行パイプラインとコマンド体系を追う: [implementation/runtime-and-commands.ja.md](implementation/runtime-and-commands.ja.md)
6. ドメイン設計の current implementation を追う: [implementation/domain-design-measurement.ja.md](implementation/domain-design-measurement.ja.md)
7. アーキテクチャ設計の current implementation を追う: [implementation/architecture-design-measurement.ja.md](implementation/architecture-design-measurement.ja.md)

## ディレクトリ構成

### `guides/`

- [user-guide.ja.md](guides/user-guide.ja.md)
  - 初回利用者向けのクイックスタートです。

### `reference/`

- [metric-reading-guide.ja.md](reference/metric-reading-guide.ja.md)
  - `score` `confidence` `unknowns` と summary metric の共通の読み方をまとめます。
- [domain-design-metrics.ja.md](reference/domain-design-metrics.ja.md)
  - ドメイン設計指標の意味、悪い兆候、改善アクションを人間向けに整理します。
- [architecture-design-metrics.ja.md](reference/architecture-design-metrics.ja.md)
  - アーキテクチャ設計指標の意味、悪い兆候、改善アクションを人間向けに整理します。

### `implementation/`

- [runtime-and-commands.ja.md](implementation/runtime-and-commands.ja.md)
  - 実行パイプライン、コマンド体系、出力契約を整理します。
- [domain-design-measurement.ja.md](implementation/domain-design-measurement.ja.md)
  - ドメイン設計の current implementation における解析器、入力依存、`unknowns`、rollout 挙動を整理します。
- [architecture-design-measurement.ja.md](implementation/architecture-design-measurement.ja.md)
  - アーキテクチャ設計の current implementation における source precedence、proxy、report/gate 挙動を整理します。

### `concepts/`

- [platform-vision.ja.md](concepts/platform-vision.ja.md)
  - 背景、Vision、対象範囲を定義します。
- [measurement-model.ja.md](concepts/measurement-model.ja.md)
  - 評価領域共通の計測モデルを定義します。
- [data-model.ja.md](concepts/data-model.ja.md)
  - Artifact、Evidence、MetricScore などの標準データ構造を定義します。
- [domain-design.ja.md](concepts/domain-design.ja.md)
  - ドメイン設計評価の概念仕様です。
- [architecture-design.ja.md](concepts/architecture-design.ja.md)
  - APSI を中心にしたアーキテクチャ設計評価の概念仕様です。
- [architecture-scenario-model.ja.md](concepts/architecture-scenario-model.ja.md)
  - quality scenario の入力仕様です。
- [architecture-pattern-profiles.ja.md](concepts/architecture-pattern-profiles.ja.md)
  - pattern family ごとの重点と見方を整理します。
- [architecture-evidence-lifecycle.ja.md](concepts/architecture-evidence-lifecycle.ja.md)
  - greenfield / brownfield で evidence source がどう切り替わるかを整理します。

### `operations/`

- [policy-and-ci.ja.md](operations/policy-and-ci.ja.md)
  - 閾値設定、レビュー条件、CI 運用を定義します。
- [architecture-source-collectors.ja.md](operations/architecture-source-collectors.ja.md)
  - canonical source config を evidence に接続する collector と example config をまとめます。

### `roadmap/`

- [phased-delivery.ja.md](roadmap/phased-delivery.ja.md)
  - 実装フェーズ、導入順序、MVP から将来拡張までの道筋を定義します。
- [tda-persistent-homology-task.ja.md](roadmap/tda-persistent-homology-task.ja.md)
  - persistence-topology locality の実験的 rollout メモです。
