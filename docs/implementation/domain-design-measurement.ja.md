# ドメイン設計の current implementation

この文書は `domain_design` の current implementation を説明します。

概念上の数式は [../concepts/domain-design.ja.md](../concepts/domain-design.ja.md)、人間向けの読み方は [../reference/domain-design-metrics.ja.md](../reference/domain-design-metrics.ja.md) を参照します。

## source of truth

- コマンド分岐: `src/commands.ts`
- スコア合成: `src/core/scoring.ts`
- review 変換: `src/core/review.ts`
- report / gate: `src/core/report.ts`

## 現在の処理フロー

`score.compute --domain domain_design` は現在おおむね次を行います。

1. policy と model を読む
2. リポジトリを解析する
3. contract usage と boundary leak を検出する
4. Git 履歴を正規化して `ELS` を計算する
5. 必要なら persistence shadow または pilot を付与する
6. `--docs-root` がある場合だけ glossary、rules、invariants を抽出する
7. `DRF` `ULI` `BFS` `AFS` を計算する
8. 共通レスポンスを組み立てる

## Metric ごとの主入力

| Metric | 主入力 | current implementation 上の注意 |
|---|---|---|
| `DRF` | docs、rules、invariants | `--docs-root` がないと計算しない |
| `ULI` | glossary、trace link、code hit | `--docs-root` がないと計算しない |
| `BFS` | model、docs、trace link、leak、contract usage | `--docs-root` がないと計算しない |
| `AFS` | invariants、terms、trace link | `--docs-root` がないと計算しない |
| `MCCS` | repo、model、cross-context 参照、boundary leak | docs なしでも動く |
| `ELS` | repo、policy、Git 履歴 | docs なしでも動く |

## docs 依存 metric

`DRF` `ULI` `BFS` `AFS` は `--docs-root` がないと計算しません。

その場合でも:

- 実行自体は成功し得る
- response-level `unknowns` にスキップ理由が入る
- `MCCS` と `ELS` は残る

## 履歴と locality

`ELS` は正規化済み Git 履歴に依存します。

confidence が下がりやすい典型条件:

- 評価対象コミットがない
- 履歴が薄い
- 履歴解析が失敗した

履歴が薄いときは、数値より先に `confidence` と `unknowns` を読みます。

## Persistence Shadow と Pilot

locality rollout 系の surface は current implementation 上で分離されています。

- `history.analyze_persistence`: score-neutral な履歴トポロジ診断
- `history.compare_locality_models`: score-neutral な side-by-side 比較
- `score.compute --shadow-persistence`: `ELS` を変えず `result.shadow.localityModels` を追加
- `score.compute --pilot-persistence ...`: 選択 category が replacement 可能なときだけ実効 `ELS` を置き換える

pilot mode では次を返します。

- baseline `ELS`
- persistence candidate 値
- 実効 locality source
- overall / category gate 状態

## 出力上の扱い

current implementation では次が重要です。

- response-level `unknowns` はスキップ入力と近似を集約する
- metric-level `unknowns` は各 metric に残る
- `status` は `unknowns` だけでは決まらない
- `review.list_unknowns` は low confidence と unknowns を review item に変換する
- `report.generate` は別計算ではなく同じ計測結果を整形する

## 関連文書

- 共有ランタイム契約: [runtime-and-commands.ja.md](runtime-and-commands.ja.md)
- ドメイン設計指標の意味: [../reference/domain-design-metrics.ja.md](../reference/domain-design-metrics.ja.md)
- policy と threshold: [../operations/policy-and-ci.ja.md](../operations/policy-and-ci.ja.md)
