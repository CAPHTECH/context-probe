# 文書索引

このリポジトリの文書は、共通基盤と評価領域を分けて整理しています。最初の対象はドメイン設計ですが、後からアーキテクチャ設計などを追加しても構造が崩れないことを重視しています。

## 推奨読順

1. [overview/platform-vision.md](overview/platform-vision.md)
2. [platform/measurement-model.md](platform/measurement-model.md)
3. [platform/runtime-and-commands.md](platform/runtime-and-commands.md)
4. [platform/data-model.md](platform/data-model.md)
5. [domains/domain-design.md](domains/domain-design.md)
6. [domains/architecture-design.md](domains/architecture-design.md)
7. [domains/architecture-scenario-model.md](domains/architecture-scenario-model.md)
8. [domains/architecture-pattern-profiles.md](domains/architecture-pattern-profiles.md)
9. [domains/architecture-evidence-lifecycle.md](domains/architecture-evidence-lifecycle.md)
10. [domains/architecture-metric-mapping.md](domains/architecture-metric-mapping.md)
11. [operations/policy-and-ci.md](operations/policy-and-ci.md)
12. [operations/architecture-source-collectors.md](operations/architecture-source-collectors.md)
13. [roadmap/phased-delivery.md](roadmap/phased-delivery.md)

## ディレクトリ構成

### `overview/`

- [platform-vision.md](overview/platform-vision.md)
  - プラットフォームの背景、Vision、対象ユーザー、ゴール、対象範囲を定義します。

### `platform/`

- [measurement-model.md](platform/measurement-model.md)
  - 評価領域を増やしても崩れない共通計測モデルを定義します。
- [runtime-and-commands.md](platform/runtime-and-commands.md)
  - AI処理と決定的解析を分離した実行パイプライン、コマンド体系を定義します。
- [data-model.md](platform/data-model.md)
  - Artifact、Evidence、MetricScore などの標準データ構造を定義します。

### `domains/`

- [domain-design.md](domains/domain-design.md)
  - ドメイン設計評価の詳細仕様です。最初に実装対象とする評価領域です。
- [architecture-design.md](domains/architecture-design.md)
  - APSI を中核にしたアーキテクチャ設計評価の本体仕様です。
- [architecture-scenario-model.md](domains/architecture-scenario-model.md)
  - QAW / ATAM ベースの quality scenario を計算可能な形に正規化する入力仕様です。
- [architecture-pattern-profiles.md](domains/architecture-pattern-profiles.md)
  - pattern family ごとの重点指標、利得、複雑性税の見方を整理します。
- [architecture-evidence-lifecycle.md](domains/architecture-evidence-lifecycle.md)
  - greenfield / brownfield で evidence source をどう切り替えるかを定義します。
- [architecture-metric-mapping.md](domains/architecture-metric-mapping.md)
  - APSI モデルと current implementation の対応表です。

### `operations/`

- [policy-and-ci.md](operations/policy-and-ci.md)
  - 閾値設定、レビュー条件、CI運用、監査方針を定義します。
- [architecture-source-collectors.md](operations/architecture-source-collectors.md)
  - canonical source config を brownfield evidence へ接続する reference collector と example config をまとめます。

### `roadmap/`

- [phased-delivery.md](roadmap/phased-delivery.md)
  - 実装フェーズ、導入順序、MVPから将来拡張までの道筋を定義します。
