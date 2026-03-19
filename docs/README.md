# 文書索引

このリポジトリの文書は、共通基盤と評価領域を分けて整理しています。最初の対象はドメイン設計ですが、後からアーキテクチャ設計などを追加しても構造が崩れないことを重視しています。

## 推奨読順

1. [overview/platform-vision.md](overview/platform-vision.md)
2. [platform/measurement-model.md](platform/measurement-model.md)
3. [platform/runtime-and-commands.md](platform/runtime-and-commands.md)
4. [platform/data-model.md](platform/data-model.md)
5. [domains/domain-design.md](domains/domain-design.md)
6. [operations/policy-and-ci.md](operations/policy-and-ci.md)
7. [roadmap/phased-delivery.md](roadmap/phased-delivery.md)

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
  - 将来拡張としてのアーキテクチャ設計評価案です。

### `operations/`

- [policy-and-ci.md](operations/policy-and-ci.md)
  - 閾値設定、レビュー条件、CI運用、監査方針を定義します。

### `roadmap/`

- [phased-delivery.md](roadmap/phased-delivery.md)
  - 実装フェーズ、導入順序、MVPから将来拡張までの道筋を定義します。
