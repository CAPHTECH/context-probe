# アーキテクチャ設計評価仕様

- 文書版数: draft v0.1
- 評価領域ID: `architecture_design`
- 位置づけ: 次期拡張対象
- 目的: アーキテクチャ設計の適合性を、証拠ベースで比較可能にする

## 1. この評価領域が答える問い

アーキテクチャ設計評価は、主に次の問いへ答える。

1. 依存方向は意図した規約に従っているか
2. ポート / アダプタ、レイヤ、サービス境界は純度を保っているか
3. 公開契約は内部実装と適切に分離され、安定しているか
4. 実行トポロジは障害分離や責務分離に適しているか
5. 変更は局所化され、構造的な変更増幅を起こしていないか

## 2. 対象成果物

### 2.1 設計成果物

- アーキテクチャ方針文書
- ADR
- レイヤ規約、依存規約
- コンポーネント図、コンテキスト図、サービス図
- ポート / アダプタ定義
- API仕様、イベント仕様、スキーマ契約
- セキュリティゾーン、ネットワーク境界、所有境界

### 2.2 実装成果物

- アプリケーションコード
- モジュール定義、ビルド定義
- API定義、イベント定義
- IaC、デプロイマニフェスト
- ランタイム設定

### 2.3 履歴・運用成果物

- Git履歴
- PR、Issue
- リリース履歴
- Incident
- SLO / SLI

## 3. 主要機能案

| ID | 機能 | 概要 | 主な出力 |
|---|---|---|---|
| A1 | アーキテクチャモデル読込 | 明示されたアーキテクチャ意図を取り込む | Architecture Model Graph |
| A2 | 構造候補推定 | レイヤ、コンポーネント、サービス候補を推定する | Structure Candidates |
| A3 | 依存方向解析 | 規約違反依存を検出する | Dependency Direction Findings |
| A4 | 境界純度解析 | アダプタ漏れ、フレームワーク汚染、内部共有を検出する | Boundary Purity Findings |
| A5 | 契約安定性解析 | 破壊的変更、公開境界の逸脱を検出する | Interface Stability Report |
| A6 | トポロジ分離解析 | ランタイム上の意図しない共有や障害伝播を可視化する | Topology Isolation Report |
| A7 | 進化解析 | 変更増幅、跨り変更、驚きの結合を計測する | Architecture Evolution Report |
| A8 | スコア計算とCI連携 | 指標計算、閾値判定、差分回帰検出を行う | Architecture Scorecard |

## 4. 機能詳細

### A1. アーキテクチャモデル読込

#### 主コマンド案

- `arch.load_topology`
- `arch.load_constraints`

#### 目的

- 明示されたアーキテクチャ意図を取り込む
- 実装から推定した構造と、明示意図を分けて扱う

### A2. 構造候補推定

#### 主コマンド案

- `arch.infer_layer_candidates`
- `arch.infer_component_candidates`
- `arch.infer_service_boundaries`

#### 根拠

- モジュール依存
- 命名規約
- パッケージ構成
- デプロイ単位
- ownership

### A3. 依存方向解析

#### 主コマンド案

- `arch.detect_direction_violations`

#### 検出対象

- 下位レイヤから上位レイヤへの逆依存
- ドメイン層からフレームワーク層への直接依存
- ルールで禁止された横断依存

### A4. 境界純度解析

#### 主コマンド案

- `arch.detect_adapter_leaks`
- `arch.detect_framework_contamination`
- `arch.detect_shared_internal_components`

#### 検出対象

- ポートを経由しないアダプタ呼び出し
- ドメインモデルへのフレームワーク注釈浸食
- 公開していない内部コンポーネントの共有

### A5. 契約安定性解析

#### 主コマンド案

- `arch.detect_contract_breaks`
- `arch.detect_schema_drift`

#### 検出対象

- 破壊的な API / Event / Schema 変更
- Published Language と実装DTOの乖離
- バージョニング規約違反

### A6. トポロジ分離解析

#### 主コマンド案

- `arch.detect_runtime_sharing`
- `arch.score_topology_isolation`

#### 検出対象

- 障害が連鎖しやすい同期依存
- 共有DBや共有キャッシュによる密結合
- セキュリティゾーン越境

### A7. 進化解析

#### 主コマンド案

- `history.mine_cochange`
- `arch.score_architecture_evolution`

#### 観点

- 変更が局所化されるか
- 小変更が広範囲改修に波及していないか
- 設計意図と実際の変更の流れがずれていないか

## 5. 指標案

この領域の指標は初期案であり、実データ検証を前提とする。

### 5.1 `DDS`: Dependency Direction Score

```text
DDS = 0.60*(1-IDR) + 0.25*LRC + 0.15*APM
```

- `IDR`: Illegal Dependency Ratio
- `LRC`: Layer Rule Compliance
- `APM`: Abstraction Path Match

### 5.2 `BPS`: Boundary Purity Score

```text
BPS = 0.45*(1-ALR) + 0.30*FCC + 0.25*(1-SICR)
```

- `ALR`: Adapter Leak Ratio
- `FCC`: Framework Containment Compliance
- `SICR`: Shared Internal Component Ratio

### 5.3 `IPS`: Interface Protocol Stability

```text
IPS = 0.50*CBC + 0.25*(1-BCR) + 0.25*SLA
```

- `CBC`: Contract Backward Compatibility
- `BCR`: Breaking Change Ratio
- `SLA`: Schema Language Adherence

### 5.4 `TIS`: Topology Isolation Score

```text
TIS = 0.40*FI + 0.30*RC + 0.30*(1-SDR)
```

- `FI`: Failure Isolation
- `RC`: Runtime Containment
- `SDR`: Shared Dependency Ratio

### 5.5 `AELS`: Architecture Evolution Locality Score

```text
AELS = 0.40*CAL + 0.30*(1-CA) + 0.30*(1-SCR)
```

- `CAL`: Change Amplification Locality
- `CA`: Change Amplification
- `SCR`: Surprise Coupling Ratio

### 5.6 比較用総合指数案

```text
AAFI = 0.25*DDS + 0.20*BPS + 0.20*IPS + 0.15*TIS + 0.20*AELS
```

この総合指数は、候補比較と時系列比較専用であり、絶対評価には使わない。

## 6. 代表ユースケース

### 6.1 レイヤードアーキテクチャの健全性確認

- レイヤ規約が守られているか
- ドメイン層がフレームワーク依存で汚染されていないか

### 6.2 ヘキサゴナル化リファクタリングの比較

- 案Aはポート / アダプタ分離が強いが依存数が多い
- 案Bは変更局所性が高いが共有コンポーネントが残る

### 6.3 マイクロサービス分割前後比較

- 契約安定性とトポロジ分離度が改善したか
- shared database が残っていないか

## 7. 実装方針

この領域は、ドメイン設計パックの後続として導入する。

1. まず `DDS` `BPS` のような静的解析寄りの指標から始める
2. 次に契約安定性とトポロジ解析を足す
3. 最後に運用データを含む `TIS` や `AELS` を強化する

## 8. 注意点

- アーキテクチャ意図が文書化されていない場合、推定依存が増え `confidence` が下がる
- ランタイム分離度は、コードだけではなくIaCや運用情報が必要になる
- この領域の指標式は実証で調整される前提であり、初期段階では比較用途に限定する
