# Repo 適用プレイブック

このガイドは、既存のリポジトリに `context-probe` を適用するときの、
いちばん安定した最短ルートです。

何の入力ファイルもない状態から始めて、
「保守する YAML と観測結果ファイルがそろい、人が読んで判断できる計測結果がある」
状態まで進めることを目的にしています。

## このプレイブックが扱う範囲

対象フローは次です。

1. レビュー用の下書きを scaffold する
2. 残す入力だけを整えて保守対象にする
3. 初回計測を回す
4. 代理値が多い指標に観測結果ファイルを足す
5. 計測メモを記録する

このガイドは、特定のリポジトリ名や self-measurement 固有の配置を前提にしません。
一般的な repo 適用手順として読めるようにしています。

## 最初の実行と本命の実行

このガイドでは、次の言葉を次の意味で使います。

- `scaffold`: CLI が返す下書きです。まずレビューして直す前提で使います。
- `curated input`: 対象 repo に残して、今後も保守していく YAML です。
- `starter run`: まず方向を見るための最初の実行です。大きな取り違えや、
  何が足りないかを確認するために使います。
- `authoritative run`: 保守対象の入力と観測結果をそろえた、本命の実行です。
  実際の設計レビューではこちらを基準にします。
- `scenarioObservationsTemplate`: 観測値そのものではなく、benchmark や障害レビューの結果を
  記入するためのテンプレートです。

多くの repo では、`domain_design` は `domain-model.yaml` を整えると
かなり使いやすくなります。`architecture_design` は、
制約ファイルに加えて scenario、runtime、telemetry、delivery、
contract baseline などの証拠がそろうと、一段上の品質になります。

## Step 1. レビュー用の下書きを Scaffold する

いきなり保守対象の YAML を書くのではなく、まず下書きを出します。

```bash
npm run dev -- model.scaffold \
  --repo /path/to/target-repo \
  --docs-root /path/to/target-repo/docs
```

```bash
npm run dev -- constraints.scaffold \
  --repo /path/to/target-repo
```

返ってきた YAML は、そのまま正本にせず、レビューしてから保存します。

最初に置くと扱いやすいファイルは次です。

- `domain-model.scaffold.yaml`
- `architecture-constraints.scaffold.yaml`
- `architecture-scenario-catalog.scaffold.yaml`
- `architecture-topology-model.scaffold.yaml`
- `architecture-boundary-map.scaffold.yaml`
- `architecture-scenario-observations.template.yaml`

## Step 2. 残す入力だけを整えて保守対象にする

scaffold の出力は完成版ではありません。

この段階の目的は、完璧なモデルを作ることではありません。
明らかに不自然な候補や不要な候補を落として、
「この repo に残してよい」と思える入力に近づけることです。

最初に curated 化する対象は次です。

- `domain-model.yaml`
  - 残したい context を残す
  - 必要な explicit aggregate を追加する
  - 技術寄りで不自然な候補を落とす
- `architecture-constraints.yaml`
  - 本当に採用したい layer と allowed edge を残す
  - repo で意味を持たない汎用的な starter layer を落とす
  - 必要なら complexity cost などの metadata を足す

scaffold ファイルは比較用の下書きとして残し、
curated ファイルを保守対象にします。

運用の基本は次です。

- 下書きは比較のために残してよい
- curated ファイルができたら、以後の計測はそちらを使う
- curated ファイルは、レビュー基準を改善したいときだけ意図して更新する

## Step 3. 初回計測を回す

まずは domain と architecture を 1 回ずつ回します。

Domain の初回計測:

```bash
npm run dev -- score.compute \
  --domain domain_design \
  --repo /path/to/target-repo \
  --model /path/to/target-repo/docs/architecture/context-probe/domain-model.yaml \
  --policy fixtures/policies/default.yaml \
  --docs-root /path/to/target-repo/docs
```

Architecture の初回計測:

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo /path/to/target-repo \
  --constraints /path/to/target-repo/docs/architecture/context-probe/architecture-constraints.yaml \
  --scenario-catalog /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-catalog.scaffold.yaml \
  --topology-model /path/to/target-repo/docs/architecture/context-probe/architecture-topology-model.scaffold.yaml \
  --boundary-map /path/to/target-repo/docs/architecture/context-probe/architecture-boundary-map.scaffold.yaml \
  --policy fixtures/policies/default.yaml
```

初回計測では次を見ます。

- どの指標はすでに方向を見るのに十分か
- どの unknown は入力不足が原因か
- `domain-model` と `constraints` をもう一段見直すべきか

初回計測を過大評価しないことが重要です。この実行の目的は、
「だいたい合っているか」「どこがまだ proxy か」「何の入力が足りないか」を見ることです。

review queue が欲しいときは次を使います。

```bash
npm run dev -- review.list_unknowns ...
```

## Step 4. 必要な観測を足す

`architecture_design` では、次の入力を足すと
初回計測の結果がレビューに耐える結果へ上がりやすくなります。

- `scenario-observations`: `QSF` を改善する
- `contract-baseline`: `IPS` を改善する
- `runtime-observations`: `TIS` を改善する
- `pattern-runtime-observations`: `OAS` を改善する
- `telemetry-observations`: `OAS` を改善する
- `delivery-observations` または delivery export: `EES` を改善する

`architecture-scenario-observations.template.yaml` は確認表として使います。
benchmark や障害レビューの結果を元に埋めてください。
unknown を消すためだけに観測値を作ってはいけません。

`domain_design` で効果が大きいのは通常次です。

- `domain-model.yaml` の explicit aggregate
- `--docs-root` で取れる docs coverage
- locality 系に必要な十分な git history

初回計測の結果が曖昧なときに使う深掘りコマンドは次です。

- `doc.extract_*`: 用語、ルール、不変条件の抽出結果を見る
- `trace.*`: model-to-code、term-to-code の linking を見る
- `history.*`: locality や co-change の証拠を見る

実装仕様が必要になったときだけ、
[../implementation/runtime-and-commands.ja.md](../implementation/runtime-and-commands.ja.md)
を参照します。

実務上の判断基準は次です。

- 初回計測の結果だけで設計の話ができるなら、そこでいったん止める
- 重要な指標が proxy のままなら、その指標に効く観測だけ足す
- 結果がおかしいと感じたら、YAML を増やす前に extraction、trace、history を確認する

## Step 5. Authoritative Assessment を回す

curated input と観測結果ファイルがそろったら、本命の bundle を回します。

```bash
npm run dev -- score.compute \
  --domain architecture_design \
  --repo /path/to/target-repo \
  --constraints /path/to/target-repo/docs/architecture/context-probe/architecture-constraints.yaml \
  --scenario-catalog /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-catalog.scaffold.yaml \
  --scenario-observations /path/to/target-repo/docs/architecture/context-probe/architecture-scenario-observations.yaml \
  --topology-model /path/to/target-repo/docs/architecture/context-probe/architecture-topology-model.scaffold.yaml \
  --boundary-map /path/to/target-repo/docs/architecture/context-probe/architecture-boundary-map.scaffold.yaml \
  --runtime-observations /path/to/target-repo/docs/architecture/context-probe/architecture-runtime-observations.yaml \
  --pattern-runtime-observations /path/to/target-repo/docs/architecture/context-probe/architecture-pattern-runtime-observations.yaml \
  --telemetry-observations /path/to/target-repo/docs/architecture/context-probe/architecture-telemetry-observations.yaml \
  --delivery-observations /path/to/target-repo/docs/architecture/context-probe/architecture-delivery-observations.yaml \
  --contract-baseline /path/to/target-repo/docs/architecture/context-probe/architecture-contract-baseline.yaml \
  --policy fixtures/policies/default.yaml
```

`domain_design` では、`domain-model.yaml` と `--docs-root` をきちんと維持し、
最後まで待ちます。大きい repo でも、
時間を短くするために profile を縮めるより、
本命の実行として扱うほうを優先します。

## Step 6. Assessment を記録する

curated input の横に、短い計測メモを残します。

最低限残す内容は次です。

- 日付
- repo path または revision
- 使った入力
- 最終的な主要メトリクス
- 残っている unknown の大分類
- 次の follow-up

これがあると、次回以降に比べる基準が安定します。

このメモは外部向けの報告書ではありません。今後その repo を見る人が、

- 何を測ったのか
- どこまで信用してよいのか
- 次に何を詰めるべきか

をすぐ分かるようにするための記録です。

## 目的別コマンドマップ

| 目的 | コマンド |
| --- | --- |
| 最初の入力を scaffold する | `model.scaffold`, `constraints.scaffold` |
| 最初の assessment を回す | `score.compute`, `report.generate`, `gate.evaluate` |
| まだ review が必要な箇所を見る | `review.list_unknowns` |
| 文書からの抽出証拠を確認する | `doc.extract_*` |
| trace linking を確認する | `trace.link_terms`, `trace.link_model_to_code` |
| history の証拠を確認する | `history.*` |
| 高度な rollout 運用をする | shadow rollout commands, self-measurement runbook |

## どこで止めればよいか

次の状態なら、ひとまず十分です。

- README から playbook にすぐ辿れる
- starter run と authoritative run の違いが明確
- curated input が対象 repo の横に置かれている
- observation は必要な箇所だけに足している
- 計測メモが残り unknown を説明している

ここまで来れば、実用上の最初の導入としては十分です。
すべての unknown を消し切る必要はありません。必要になったときに、
観測や curated input を少しずつ足していけば足ります。
