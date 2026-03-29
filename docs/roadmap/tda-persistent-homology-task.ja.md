# パーシステントホモロジー導入タスク

## 1. 目的

`context-probe` へ TDA を導入する際に、価値が高く再現性のある範囲から段階的に進める。

このタスクは、設計レビューの結論を実装可能な順序へ落とし込むための作業メモである。

## 2. 結論サマリ

採用:
- `0D persistence` を co-change 分析の補助診断として pilot する
- `TSI` を導入する場合は独立 metric または bridge metric として扱う
- BFS 候補比較は別コマンドとして扱う

採用しない:
- `ELS` の意味を即座に置き換える本実装
- `ELS` 由来の `TSI` をそのまま `APSI` へ流す実装
- `TSI` を `confidence` に混ぜる設計
- `MCCS + beta1` を初期導入フェーズで進める案

## 3. 前提認識

- 現行 `ELS` は commit 単位の局所性平均であり、PH は別の意味を持つ
- 現行 `APSI` は architecture 側 summary であり、すでに `AELS -> EES -> APSI` の流れを持つ
- 現行 `MCCS` は directed import leak / contract adherence の違反検出であり、グラフ形状評価ではない
- 現行 `BFS` は与えられた境界の採点器であり、候補生成器ではない

## 4. 実装順序

### Task 0: History hygiene を先に整える

目的:
- TDA がノイズを精密に増幅しないように、co-change 入力の品質を先に上げる

作業:
- `normalizeHistory` の入力品質を見直す
- merge commit、rename、bulk change、windowing 方針を明示する
- `history.score_evolution_locality` の confidence が過信を生まないように見直す
- history 系 unknowns を `relevant commit count` 基準で整理する

完了条件:
- history ノイズの扱いがドキュメント化されている
- history 系 command の confidence が input quality を反映する

### Task 1: shared co-change persistence kernel を追加する

目的:
- まず `beta0` だけを扱う最小実装を作る

作業:
- co-change graph の edge weight 定義を固定する
- raw count のままにせず、必要なら Jaccard / PMI / lift の候補を比較する
- `Union-Find` ベースで 0D persistence を計算する
- `all-equal weight`、`range=0`、single-context、empty-history を明示的に扱う

完了条件:
- persistence kernel が `ELS` 本体から独立してテスト可能
- 退化ケースが fixture 付きで検証されている

### Task 2: score-neutral な experimental history 診断を追加する

目的:
- `ELS` を置換せず、まず価値を観察する

作業:
- 新規 command を追加する
- 候補名:
  - `history.analyze_persistence`
  - `history.explain_cochange_topology`
- 出力は raw persistence diagram ではなく、次を既定表示にする
  - stable change clusters
  - natural split levels
  - noise ratio
- 図や barcode は debug / appendix 扱いに留める

完了条件:
- `score.compute` の既存 `ELS` 契約と threshold を壊さない
- experimental command の結果から再設計候補を説明できる

### Task 3: AELS 寄りの TSI を別 metric として検討する

目的:
- `ELS -> APSI` 直結ではなく、architecture 側の locality 文脈で `TSI` を評価する

作業:
- `AELS` 側の boundary pair count と persistence の接続可能性を検討する
- `TSI` の式を固定する
- `TSI` は `MetricScore.value` として扱い、`confidence` とは分離する
- `APSI` へ入れる前に単独 metric として運用評価する

完了条件:
- `TSI` の意味が `AELS` / `TIS` / `APSI` と衝突しない
- locality の二重計上が起きない

### Task 4: BFS 候補比較を別コマンドとして試作する

目的:
- BFS 採点と候補探索を分離する

作業:
- 新規 command として試作する
- 候補名:
  - `boundary.suggest`
  - `model.suggest_boundaries`
- 候補比較モードで複数分割案を比較できるようにする
- `beta0 = k` が長く持続する分割を候補として示す

完了条件:
- `computeBoundaryFitness` は採点器のまま維持される
- 候補生成ロジックが `score.compute` に混ざらない

### Task 5: MCCS + beta1 は保留する

理由:
- 現行 `MCCS` は directed leak semantics であり、通常のホモロジーと意味が揃っていない
- `beta1` を入れる前に、まず SCC / cycle basis で十分かを検証すべき

再開条件:
- directed graph をどう complex 化するか仕様が固定されている
- `beta1` が leak semantics に対して説明可能である

## 5. No-Go 条件

次のいずれかに当てはまる場合、この導入は先送りする。

- `ELS` の既存 trend 比較が破壊される
- policy の declarative formula では説明しにくい hidden logic が増える
- `confidence` と `score` の意味が混線する
- `APSI` に locality が二重計上される
- `beta1` の数学仕様を説明できない

## 6. テスト方針

最低限必要:
- empty history
- thin history
- single context only
- all edges same weight
- one dominant stable cluster
- many short-lived noisy clusters
- hub context があるケース

追加で必要:
- edge weight 正規化ごとの差分比較
- `ELS` 既存 fixture との非互換検知
- `AELS` への接続時の locality 二重計上検知

## 7. ユーザー向け表現

既定文言:
- threshold を変えても崩れない co-change 群
- 自然な切れ目
- ノイズが多い変更関係

避ける表現:
- persistence diagram
- barcode
- beta0 / beta1

これらは debug 表示または appendix に限定する。

## 8. 当面の推奨実行順

1. Task 0 を行う
2. Task 1 を `beta0 only` で実装する
3. Task 2 を experimental command として出す
4. pilot 結果が良ければ Task 3 を検討する
5. Task 4 は別トラックで prototype する
6. Task 5 は明示的に defer する

## 9. このタスクの判断

Go:
- `beta0 only`
- experimental command
- score-neutral pilot

No-Go:
- `ELS -> TSI -> APSI` の即時接続
- `TSI in confidence`
- `MCCS + beta1` の先行実装

Defer:
- BFS 候補探索の本格導入
