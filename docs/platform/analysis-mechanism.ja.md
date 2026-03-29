# 解析の仕組み

- 文書版数: v0.1
- 対象: current implementation
- 主読者: CLI 利用者
- 目的: `score.compute` を中心に、どの入力がどの解析器を通って `metrics` `unknowns` `confidence` `evidence` に反映されるかを、コードを読まずに追えるようにする

## 1. 目的と読者

この文書は、現行 CLI の解析経路を説明するためのものです。

- 概念上の実行パイプラインは [runtime-and-commands.md](runtime-and-commands.md) を正とする
- 共通モデルと出力契約は [measurement-model.md](measurement-model.md) と [data-model.md](data-model.md) を正とする
- 各指標の意味や式そのものは [../domains/domain-design.md](../domains/domain-design.md) と [../domains/architecture-design.md](../domains/architecture-design.md) を正とする

この文書では、意味論の再定義ではなく、current implementation がどう解析しているかに絞って説明します。

source of truth は主に次の実装です。

- コマンド分岐: `src/commands.ts`
- スコア合成: `src/core/scoring.ts`
- review 反映: `src/core/review.ts`
- report / gate 反映: `src/core/report.ts`

## 2. 解析全体像

current implementation では、`score.compute` が解析の入口です。

```text
score.compute
  -> policy 読込
  -> domain 判定
     -> domain_design: computeDomainDesignScores
     -> architecture_design: computeArchitectureScores
  -> createResponse
     -> metrics / evidence / confidence / unknowns / diagnostics / provenance

review.list_unknowns
  -> score.compute の結果を review item へ変換

report.generate
  -> score.compute の結果を Markdown へ整形

gate.evaluate
  -> score.compute の結果を policy 閾値で判定
```

補足:

- `--domain` を省略すると `domain_design` が選ばれます
- 実際に計算されるメトリクス集合は、選択された policy profile にその metric 定義があるかで決まります
- `unknowns` が増えても、`score.compute` の `status` が必ず `warning` になるわけではありません

## 3. 共通の解析部品

| 部品 | 主な役割 | 主に使う領域 |
|---|---|---|
| `parseCodebase` | ソースファイル、依存関係、参照情報を構築する | 両方 |
| `normalizeHistory` | Git 履歴を正規化する | 両方 |
| `extractGlossary` | 文書から用語候補を抽出する | ドメイン設計 |
| `extractRules` | 文書からルール候補を抽出する | ドメイン設計 |
| `extractInvariants` | 文書から不変条件候補を抽出する | ドメイン設計 |
| `buildTermTraceLinks` | 用語を文書とコードへ追跡する | ドメイン設計 |
| `createResponse` | 共通レスポンス形式へ包む | 両方 |
| `confidenceFromSignals` | 複数の根拠から response / metric の `confidence` を合成する | 両方 |
| `listReviewItems` | `unknowns`、低 confidence、collision を review item に変換する | 両方 |
| `renderMarkdownReport` | score response を Markdown 表示用に整形する | 両方 |
| `evaluateGate` | policy の閾値で `ok / warning / error` を判定する | 両方 |

読み方のポイント:

- `parseCodebase` と `normalizeHistory` は「共通の観測基盤」です
- ドメイン設計だけが文書抽出と trace link を強く使います
- アーキテクチャ設計は raw / export / source config の ingest と normalization が多い構成です

## 4. ドメイン設計の解析フロー

### 4.1 処理順

`computeDomainDesignScores` は、概ね次の順で処理します。

1. policy と model を受け取る
2. `parseCodebase` でコードベースを解析する
3. `detectContractUsage` と `detectBoundaryLeaks` で `MCCS` 系の材料を集める
4. `normalizeHistory` と `scoreEvolutionLocality` で `ELS` の材料を集める
5. 必要に応じて experimental な `history.analyze_persistence` で co-change の持続構造を補助診断する
6. 必要に応じて `history.compare_locality_models` で `ELS` と beta0 persistence 候補を比較するか、`score.compute --shadow-persistence` で同じ比較結果を shadow payload として付与する
7. `--docs-root` がある場合だけ、`extractGlossary` / `extractRules` / `extractInvariants` を lazy cache 付きで実行する
8. `buildTermTraceLinks`、`computeBoundaryFitness`、`computeAggregateFitness` で文書起点メトリクスを組み立てる
9. `evaluateFormula` で metric ごとの値を計算する
10. `createResponse` で `metrics` `leakFindings` `history` `crossContextReferences` を返す

current implementation 上の特徴:

- 文書抽出系は `--docs-root` がないと実行されません
- `DRF` `ULI` `BFS` `AFS` は docs 依存です
- `MCCS` と `ELS` は docs なしでも動きます
- `history.analyze_persistence` は score-neutral の補助診断であり、`ELS` の置き換えではありません
- `history.compare_locality_models` は score-neutral の比較コマンドであり、`ELS` と beta0 persistence 候補の calibration にだけ使います
- `score.compute --shadow-persistence` を有効にしても、source-of-truth の metric は `ELS` のままで、`result.shadow.localityModels` が増えるだけです
- `score.compute --pilot-persistence --rollout-category <category> --shadow-rollout-registry <path>` は同じ shadow payload を計算しつつ、選択した category gate が `replace` のときだけ実効 `ELS` を persistence candidate に切り替えます
- pilot mode の適用結果は `result.pilot` に入り、baseline `ELS`、candidate 値、実効 locality source、overall/category gate 状態を返します
- `score.observe_shadow_rollout_batch` は curated な repo 集合で shadow 差分を比較するためのコマンドで、本番 scoring 自体は変えません
- `gate.evaluate_shadow_rollout` は versioned registry または live batch 観測から採用 gate を評価するためのコマンドで、本番 scoring 自体は変えません
- heuristic glossary は CLI flag、path、artifact ID、response field path、snake_case 設定名のような構造参照を用語候補から除外します
- response の `unknowns` は、メトリクス単位の `unknowns` とは別に、スキップや履歴不足も集約されます

### 4.2 メトリクス別の見方

| Metric | 主入力 | 主解析器 / 関数 | 状態 | `unknowns` が増える代表条件 | `evidence` の出所 |
|---|---|---|---|---|---|
| `DRF` | `docs-root` 配下の文書 | `extractRules`, `extractInvariants`, `buildReviewItemsForCandidates`, `computeDrfComponents` | 実装済み | rule / invariant が抽出されない、use case 相当記述が少ない、曖昧候補が多い | rule / invariant の抽出 evidence |
| `ULI` | 文書、コード、trace link | `extractGlossary`, `buildTermTraceLinks`, `computeUliComponents` | 実装済み | term が抽出されない、alias が観測されない、trace が弱い | glossary evidence と trace gap の derived evidence |
| `BFS` | 文書、model、codebase | `computeBoundaryFitness`, `buildModelCodeLinks` | 実装済み | context への局所化が弱い、ownership / security 根拠が薄い、cross-context 参照が少ない | `computeBoundaryFitness` が生成する evidence |
| `AFS` | 不変条件、用語、trace link | `computeAggregateFitness` | 実装済み | invariant の責務割当が曖昧、強整合 invariant が少ない | `computeAggregateFitness` が生成する evidence |
| `MCCS` | repo、model | `detectContractUsage`, `detectBoundaryLeaks` | 実装済み | context 間参照が観測されず適用対象が少ない | boundary leak の derived evidence |
| `ELS` | repo、policy、Git 履歴 | `normalizeHistory`, `scoreEvolutionLocality` | 実装済み | Git 履歴がない、履歴が少ない、履歴解析に失敗する | metric 自体の `evidenceRefs` は空、代わりに `result.history` が返る |
| `history.analyze_persistence` | repo、policy、Git 履歴 | `normalizeHistory` を基にした co-change topology inspection | experimental | 履歴が薄い、重みが退化する、context が 1 個しかない | score を返さない補助診断のため、inspection summary を返す |
| `history.compare_locality_models` | repo、policy、Git 履歴 | `scoreEvolutionLocality` と beta0 persistence 候補の side-by-side 比較 | experimental | 履歴が薄い、重みが退化する、context が 1 個しかない | `ELS` の既存面と persistence 候補を並べて返す |

### 4.3 docs 依存メトリクスの current implementation

`--docs-root` がない場合、`DRF` `ULI` `BFS` `AFS` は計算されず、response-level の `unknowns` に次のようなメッセージが追加されます。

- `` `--docs-root` が指定されていないため DRF をスキップしました ``
- `` `--docs-root` が指定されていないため ULI をスキップしました ``
- `` `--docs-root` が指定されていないため BFS をスキップしました ``
- `` `--docs-root` が指定されていないため AFS をスキップしました ``

つまり docs なしでも `score.compute` は成功しますが、文書起点の適合度は未観測のままです。

### 4.4 履歴依存メトリクスの current implementation

`ELS` は `normalizeHistory` に依存します。

- Git 履歴が 0 件なら `unknowns` に「評価可能なコミットが見つからない」が出る
- Git 履歴が少ないと「暫定値」が出る
- 履歴解析に失敗すると `diagnostics` に履歴スキップ理由が入り、`confidence` も大きく下がる

ここで重要なのは、`ELS` の値と `confidence` は別物であることです。高い `ELS` が出ても、履歴不足なら利用判断は保留にすべきです。

## 5. アーキテクチャ設計の解析フロー

### 5.1 処理順

`computeArchitectureScores` は、概ね次の順で処理します。

1. policy と constraints を受け取る
2. `parseCodebase` でコードベースを解析する
3. 静的適合を計算する
   - `scoreDependencyDirection` -> `DDS`
   - `scoreBoundaryPurity` -> `BPS`
   - `scoreInterfaceProtocolStability` -> `IPS`
4. scenario / topology を計算する
   - `scoreQualityScenarioFit` -> `QSF`
   - `scoreTopologyIsolation` -> `TIS`
5. telemetry / pattern runtime を正規化・ingest して `scoreOperationalAdequacy` へ渡し、`OAS` を作る
6. delivery を正規化・ingest し、`scoreArchitectureEvolutionEfficiency` と組み合わせて `EES` を作る
7. complexity export / source / constraints metadata を使って `CTI` を作る
8. Git 履歴と `boundaryMap` または `constraints.layers` を使って `AELS` を作る
9. `DDS` `BPS` `IPS` `OAS` `EES` `CTI` などを束ねて `APSI` を作る
10. `detectDirectionViolations` と各 finding から `evidence` を構築し、`createResponse` で返す

current implementation 上の特徴:

- 単一 analyzer ではなく、ingest / normalization / proxy / summary 合成が多段で入ります
- `APSI` は summary-only metric で、下位指標の代替ではありません
- `QSF` `OAS` `CTI` `AELS` `EES` `APSI` は partial / proxy 要素を含みやすい構成です

### 5.2 入力優先順位

#### scenario input

| 優先順位 | current implementation |
|---|---|
| 1 | `scenario-observations` |
| 2 | `scenario-observation-source` |
| 3 | 未指定なら `QSF` は未観測 |

補足:

- `scenario-catalog` は観測値の代わりではなく、scenario 定義側の入力です
- `scenario-observations` がある場合、source config は無視された旨が `unknowns` に出ます

#### telemetry / pattern runtime input

| 対象 | 優先順位 | 補足 |
|---|---|---|
| `CommonOps` | `telemetry-observations` -> `telemetry-raw-observations + telemetry-normalization-profile` -> `telemetry-export` -> `telemetry-source` | raw だけでは十分でなく、normalization profile が必要です |
| `PatternRuntime` | `pattern-runtime-observations` -> `pattern-runtime-raw-observations + pattern-runtime-normalization-profile` -> telemetry export 内の pattern runtime -> `TIS` bridge | runtime 観測がなければ `OAS` は `TIS` bridge を使います |

#### delivery / complexity input

| 対象 | 優先順位 | 補足 |
|---|---|---|
| `Delivery` | `delivery-observations` -> `delivery-raw-observations + delivery-normalization-profile` -> `delivery-export` -> `delivery-source` | raw だけでは十分でなく、normalization profile が必要です |
| `CTI` | `complexity-export` -> `complexity-source` -> constraints metadata / codebase-derived proxy | export が source より優先されます |

### 5.3 メトリクス別の見方

| Metric | 主入力 | 主解析器 / 関数 | 状態 | fallback / precedence の要点 | `unknowns` / `evidence` の見方 |
|---|---|---|---|---|---|
| `QSF` | scenario catalog, observations / source | `scoreQualityScenarioFit` | 部分実装 | explicit observation が source より優先 | scenario 未指定なら未観測。evidence は scenario finding と source finding |
| `DDS` | repo, constraints | `scoreDependencyDirection` | 実装済み | なし | 分類できる依存が少ないと `unknowns`。evidence は direction violation |
| `BPS` | repo, constraints | `scoreBoundaryPurity` | 実装済み | なし | purity finding がそのまま evidence |
| `IPS` | repo, constraints | `scoreInterfaceProtocolStability` | 実装済み | なし | contract / schema finding が evidence |
| `TIS` | topology model, runtime observations | `scoreTopologyIsolation` | 実装済み | topology 観測が薄いと低 confidence | topology 未指定時は未観測寄り。evidence は topology finding |
| `OAS` | telemetry, pattern runtime, topology bridge | `normalizeTelemetryObservations`, `normalizePatternRuntimeObservations`, `ingestTelemetryExportBundle`, `scoreOperationalAdequacy` | 部分実装 | pattern runtime がなければ `TIS` bridge | 中立値、bridge、priority 無視が `unknowns` に出る。evidence は telemetry / normalization / operations finding |
| `CTI` | codebase, constraints, complexity export / source | `ingestComplexityExportBundle`, `scoreComplexityTax` | 部分実装 | export が source より優先 | metadata 不足や未観測 component が `unknowns` に出る。evidence は complexity finding |
| `AELS` | Git 履歴, boundary map / constraints layers | `scoreArchitectureEvolutionLocality` | 部分実装 | `boundaryMap` がなければ `constraints.layers` を proxy に使う | boundary proxy 利用や履歴不足が `unknowns` に出る。evidence は evolution finding |
| `EES` | delivery input, `AELS` | `normalizeDeliveryObservations`, `ingestDeliveryExportBundle`, `scoreArchitectureEvolutionEfficiency` | 部分実装 | explicit delivery 観測が export / source より優先 | raw / export / source の優先順位と Delivery 欠損が `unknowns` に出る。evidence は delivery と evolution finding |
| `APSI` | `QSF`, `DDS`, `BPS`, `IPS`, `OAS` / `TIS`, `EES`, `CTI` | `computeArchitectureScores` 内の summary 合成 | 部分実装 | `PCS = DDS/BPS/IPS proxy`, `OAS` 未計算時は `TIS` で代用 | proxy / 中立値 / 非 default profile 利用が `unknowns` に出る。evidence は下位 metric の `evidenceRefs` を再利用 |

### 5.4 アーキテクチャ側で特に読み違えやすい点

- `APSI` は高くても supporting metrics を読まないと判断できません
- `OAS` は telemetry 直結だけでなく、raw normalization、export ingest、source config のどれからでも入るため、まず `provenance` と `unknowns` を確認すべきです
- `CTI` は実測完備ではなく、current implementation では proxy をかなり含みます
- `AELS` と `EES` は Git 履歴と boundary grouping に強く依存します

## 6. 出力への反映

### 6.1 `score.compute`

`score.compute` の response は、最終的に `createResponse` で組み立てられます。

| フィールド | current implementation での意味 |
|---|---|
| `status` | domain 側では主に `diagnostics` があると `warning`、architecture 側では主に履歴解析診断があると `warning`。`unknowns` だけでは自動で `warning` にならない |
| `confidence` | metric ごとの `confidence` を `confidenceFromSignals` で合成した値 |
| `unknowns` | スキップされた入力、proxy 利用、観測不足、priority 無視などを集約したもの |
| `diagnostics` | 抽出 fallback、履歴解析スキップなど、実行上の補足情報 |
| `provenance` | repo path、`docs-root`、profile、source config path など、入力の出どころ |

補足:

- domain 側は `provenance` に repo と optional `docs-root` が入ります
- architecture 側は repo と active profile に加え、source config を使ったときの path も追加されます

### 6.2 `review.list_unknowns`

`review.list_unknowns` は、score response を review item へ変換します。

- response-level `unknowns` はそのまま review item になります
- glossary / rule / invariant の低 confidence や collision も review item になります
- `metrics` の `confidence < 0.75` も review item になります
- upstream の `evidence` `confidence` `unknowns` `diagnostics` `provenance` は引き継がれます

つまり、`review.list_unknowns` は別の解析器ではなく、「どこに人手確認が必要か」を切り出す変換段です。

### 6.3 `report.generate`

`report.generate` は `score.compute` を再利用します。

- `--format md` のときだけ `renderMarkdownReport` が動きます
- domain 側は単純な metric 一覧です
- architecture 側は `APSI` を summary として分離し、supporting metrics を別表示にします
- proxy / partial な `unknowns` は report 側でも可視化されます

`--format md` でも JSON response の外形は維持され、Markdown 本文は `result.report` に入ります。

### 6.4 `gate.evaluate`

`gate.evaluate` も `score.compute` を再利用します。

- policy の threshold を metric ごとに評価します
- architecture 側では `APSI` を summary-only metric として扱い、`fail` でも `warnings` 側へ寄せます
- architecture 側では proxy / partial な判定材料が含まれると、追加 warning が出ます

current implementation 上の注意:

- `gate.evaluate` は upstream の `provenance` をそのまま転送していません
- その代わり、`diagnostics` に `Available packs: ...` を追加します

## 7. 関連文書

- 実行パイプラインとコマンド体系: [runtime-and-commands.md](runtime-and-commands.md)
- 共通計測モデル: [measurement-model.md](measurement-model.md)
- 標準データモデル: [data-model.md](data-model.md)
- ドメイン設計評価仕様: [../domains/domain-design.md](../domains/domain-design.md)
- アーキテクチャ設計評価仕様: [../domains/architecture-design.md](../domains/architecture-design.md)
- アーキテクチャ指標マッピング: [../domains/architecture-metric-mapping.md](../domains/architecture-metric-mapping.md)
- source config と collector の詳細: [../operations/architecture-source-collectors.md](../operations/architecture-source-collectors.md)

## 8. この文書の使い方

次の順で読むと、current implementation を追いやすくなります。

1. まず [runtime-and-commands.md](runtime-and-commands.md) で全体のライフサイクルを見る
2. 次に本書で `score.compute` の実際の分岐と metric 合成を見る
3. 指標の意味を確認したくなったら domain / architecture の各仕様書へ戻る

この順にすると、「概念仕様」と「実装中の解析経路」を混同しにくくなります。
