# ドメイン設計指標

この文書は `domain_design` の指標を人間が読むための参照文書です。

概念上の数式は [../concepts/domain-design.ja.md](../concepts/domain-design.ja.md)、current implementation の挙動は [../implementation/domain-design-measurement.ja.md](../implementation/domain-design-measurement.ja.md) を参照します。

## 全体像

| 指標 | 主に見たい問い |
|---|---|
| `DRF` | モデルは業務知識を大きく取りこぼさず表現できているか |
| `ULI` | 言葉は各 Context 内で安定し、文書とコードを追跡できるか |
| `BFS` | Bounded Context の分割理由は妥当か |
| `AFS` | 強い不変条件は適切な整合性境界に閉じているか |
| `MCCS` | 実装は設計上の境界を守っているか |
| `ELS` | 実際の変更は時間を通じて局所化しているか |

## `DRF`

モデルが重要なユースケース、ルール、不変条件を適切に反映しているかを見ます。

良い状態:

- 主要ユースケースが model element に辿れる
- 重要ルールと不変条件が明示されている
- レビュー時に中心概念の解釈が大きく割れない

悪い兆候:

- ルールが散文に埋もれている
- 図があるが実際の振る舞いと結びつかない
- 中心概念について毎回レビューが割れる

次の改善:

- ユースケースと model element の対応を明示する
- rule と invariant の一覧を分ける
- glossary と rule 側で曖昧概念を先に解消する

## `ULI`

言葉が各 Context 内で安定し、文書とコードに追跡できるかを見ます。

良い状態:

- canonical term が Context 内で安定している
- alias が意図的に管理されている
- 用語が契約やコードに辿れる

悪い兆候:

- alias が増殖する
- 翻訳境界なしで同語異義がぶつかる
- glossary の用語がコードに現れない

次の改善:

- Context ごとに glossary を管理する
- Published Language、ACL、DTO、event 名を明示する
- glossary から code への traceability を増やす

## `BFS`

Bounded Context が正しい理由で分かれているかを見ます。

良い状態:

- 不変条件やライフサイクルの signal が同じ Context に集まる
- ownership、security、change cadence の差が実際の分離になっている
- 境界の理由をチームが説明できる

悪い兆候:

- 1つのユースケースが毎回多くの Context を横断する
- ownership や security が違うのに内部型を共有している
- UI や package 都合だけで境界が決まっている

次の改善:

- attraction / separation signal を明示的に棚卸しする
- model に ownership と security の根拠を追加する
- co-change の強い境界から見直す

## `AFS`

強い不変条件が適切な整合性境界に閉じているかを見ます。

良い状態:

- 強い不変条件が 1 つの Aggregate に閉じる
- 重要 write が単一 Aggregate で完結する
- strong invariant と process invariant が分けられている

悪い兆候:

- 複数 Aggregate への atomic write が常態化する
- distributed transaction が通常運転になる
- 大きすぎる Aggregate が書き込み競合を生む

次の改善:

- invariant を strong / process に分類する
- 同期責務を持つ Aggregate を整理する
- 強い不変条件が跨る境界から見直す

## `MCCS`

コードが意図した設計境界を守っているかを見ます。

良い状態:

- cross-context 通信が公開契約経由で行われる
- 内部型が越境しない
- 設計ルールが CI で検査される

悪い兆候:

- 他 Context の internal model や service を直接 import する
- contract DTO ではなく内部 model をそのまま返す
- 設計文書があっても実装規律がない

次の改善:

- cross-context import を CI で検出する
- DTO、event、ACL の背後に連携を寄せる
- leak の多い境界から先に直す

## `ELS`

実際の変更が時間を通じて局所化しているかを見ます。

良い状態:

- feature ごとの変更が少数 Context に留まる
- recurring co-change pair が少ない
- 設計境界と進化単位が揃っている

悪い兆候:

- 毎回同じ Context ペアが一緒に変わる
- 履歴でしか見えない hidden dependency がある
- feature scatter によりレビュー範囲が広い

次の改善:

- co-change の高いペアを点検する
- issue / feature ごとの touched context 数を追跡する
- bulk format、rename、依存一括更新などのノイズを除外する

## 総合指数

`DDFI_pre` と `DDFI_post` は summary-only の比較用指標です。

用途:

- 同一システム内の候補比較
- before / after 比較
- 時系列比較

組織横断ランキングには使いません。
