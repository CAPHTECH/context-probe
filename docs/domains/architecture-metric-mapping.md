# アーキテクチャ指標マッピング

- 文書版数: v0.1
- 目的: APSI モデルと current implementation の対応を明示する

## 1. 位置づけ

本書は、概念仕様と current implementation のズレを管理するための対応表である。
仕様上の上位概念と、現時点で CLI に実装済みの metric / future metric を混同しないために置く。

## 2. 上位指標と current implementation

| 上位指標 | 役割 | current implementation | 状態 |
|---|---|---|---|
| `QSF` | scenario fit | なし | 未実装 |
| `PCS` | pattern rule conformance | `DDS`, `BPS`, `IPS` | 実装済み |
| `OAS` | runtime adequacy | `TIS` の一部が候補 | 未実装 |
| `EES` | delivery + locality | `AELS` が locality 側候補 | 部分未実装 |
| `CTI` | complexity tax | `CTI` | 部分実装 |
| `APSI` | summary index | なし | 未実装 |

## 3. current metric の意味

### `DDS`

- 主な役割: dependency direction と abstraction path の適合
- 上位指標上の位置づけ: `PCS` の構成要素

### `BPS`

- 主な役割: boundary purity の適合
- 上位指標上の位置づけ: `PCS` の構成要素

### `IPS`

- 主な役割: interface / contract stability の適合
- 上位指標上の位置づけ: `PCS` の構成要素

## 4. `CTI` の位置づけ

### `CTI`

- 想定役割: deployable / pipeline / contract / sync depth などの complexity tax を独立に可視化する
- 実装状態: static metadata と codebase-derived count による初期 proxy を実装済み
- 制約: on-call surface や run cost は metadata 依存で、未観測時は unknown 扱い

## 5. future metric の位置づけ

### `TIS`

- 想定役割: runtime containment と topology isolation
- 上位指標上の位置づけ: `OAS` の bridge 指標候補

### `AELS`

- 想定役割: architecture evolution locality
- 上位指標上の位置づけ: `EES` の locality 側候補

## 6. 今後の推奨実装順

1. `QSF`
2. `APSI`
3. `OAS` / `TIS`
4. `EES` / `AELS` の拡張

この順にする理由は、現在すでに `PCS` と初期 `CTI` の土台がある一方で、pattern suitability を成立させるには `QSF` がなお欠けているためである。

## 7. 読み方

- 概念を知りたい場合は [architecture-design.md](architecture-design.md) を先に読む
- scenario 入力を定義したい場合は [architecture-scenario-model.md](architecture-scenario-model.md) を読む
- pattern family ごとの差を見たい場合は [architecture-pattern-profiles.md](architecture-pattern-profiles.md) を読む
- phase ごとの evidence source を知りたい場合は [architecture-evidence-lifecycle.md](architecture-evidence-lifecycle.md) を読む
