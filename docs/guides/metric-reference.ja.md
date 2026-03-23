# 指標リファレンス

- 文書版数: v0.1
- 対象: `context-probe` の各種指標を人間が読んで把握するための参照文書
- 主読者: CLI 利用者、設計レビュー担当者、指標の意味を知りたい開発者

## 1. この文書の位置づけ

この文書は、散在している次の情報を1か所にまとめて読むためのガイドです。

- 何を「良い設計」とみなしているか
- 各指標が何を測るか
- CLI が現在どこまで実装しているか
- 高い値、低い値をどう読むか

source of truth は次の文書と実装です。

- 理論と式: [../domains/domain-design.md](../domains/domain-design.md), [../domains/architecture-design.md](../domains/architecture-design.md)
- current implementation の解析経路: [../platform/analysis-mechanism.md](../platform/analysis-mechanism.md)
- current implementation のポリシー式: `src/core/policy.ts`
- current implementation の実装差分: [../domains/architecture-metric-mapping.md](../domains/architecture-metric-mapping.md)

## 2. まず押さえる考え方

### 2.1 単一 KPI に潰さない

`context-probe` は、設計の良さを単一の数値へ潰し切る前提を採りません。

- ドメイン設計は、表現適合、言語整合、境界適合、不変条件閉包、実装準拠、進化局所性を分けて見る
- アーキテクチャ設計は、品質シナリオ適合、パターン準拠、実行時適合、進化効率、複雑性税を分けて見る
- 総合指数は要約値であって、判定の本体ではない

### 2.2 比較は「同一プロダクト内」で行う

このリポジトリで定義している総合指数は、組織横断ランキングのためではありません。

- 同一プロダクトの候補案比較
- 同一プロダクトの時系列比較
- リファクタリング前後比較

に使うのが前提です。

### 2.3 証拠は3層に分けて読む

| 層 | 主な証拠 | 何が見えるか |
|---|---|---|
| 設計時の先行指標 | ユースケース、用語集、ルール、不変条件、Context Map | 設計意図に対する適合 |
| 実装後の静的指標 | 依存関係、命名、契約、パッケージ構造 | 実装が設計を守っているか |
| 運用後の遅行指標 | Git 履歴、Issue、delivery、telemetry | 実際に変更や運用がどう振る舞ったか |

### 2.4 `score` と `confidence` と `unknowns` は別物

- `score`: 観測できた入力から計算した結果
- `confidence`: その計算結果をどれだけ信頼できるか
- `unknowns`: まだ未観測、未確定、proxy 利用中の部分

高い `score` が出ても、`confidence` が低く `unknowns` が多ければ、判断は保留にするべきです。

## 3. ドメイン設計指標

### 3.1 全体像

| 指標 | 見たいもの | 主入力 | current implementation |
|---|---|---|---|
| `DRF` | モデルが業務知識をどれだけ正しく表しているか | 文書、ルール、不変条件、レビュー負荷 | 実装済み |
| `ULI` | ユビキタス言語が各コンテキスト内で安定しているか | glossary、文書、コード、trace link | 実装済み |
| `BFS` | Bounded Context の分割が妥当か | model、rules、invariants、ownership/security signal | 実装済み |
| `AFS` | 強い不変条件が Aggregate に閉じているか | invariants、term trace、context 割当 | 実装済み |
| `MCCS` | 実装がモデル境界を守っているか | codebase、cross-context 参照、boundary leak | 実装済み |
| `ELS` | 変更が局所化されているか | Git 履歴、Context grouping | 実装済み |

補足:

- `DRF` `ULI` `BFS` `AFS` は `--docs-root` がないと計算されません
- `MCCS` と `ELS` は docs なしでも動きます
- current implementation では `DDFI_pre` と `DDFI_post` は文書上の定義であり、CLI 出力としてはまだ返しません

### 3.2 `DRF`: Domain Representation Fitness

```text
DRF = 0.30*SC + 0.30*RC + 0.20*(1-IV) + 0.20*RA
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `SC` | ユースケース被覆率 | モデル候補がユースケース記述とつながっている |
| `RC` | ルール被覆率 | 業務ルール、不変条件がモデルに取り込まれている |
| `IV` | 無効/不適切記述率 | 曖昧、低信頼、無関係な候補が少ない |
| `RA` | レビュー一致度 | 読んだ人の解釈が割れにくい |

読み方:

- 高い `DRF` は「業務知識の取りこぼしや誤表現が少ない」ことを示します
- 低い `DRF` は「モデルが悪い」と断定する前に、文書不足や曖昧な記述の多さを疑うべきです

current implementation の注意:

- `SC` は use case signal を含む prose fragment 比率から近似します
- `IV` は review burden と低 confidence 候補から近似します
- `RA` はレビュー負荷の低さと候補 confidence から近似します
- つまり、現状の `DRF` は完全な expert validation ではなく、文書構造と曖昧性の proxy を含みます

どうあるべきか:

- 主要ユースケースごとに、対応するモデル要素、業務ルール、不変条件が辿れる
- モデル記述をレビューしたとき、解釈の割れが小さい
- 業務上重要な概念が、図や用語だけでなくルールの形でも表現されている

悪い兆候:

- ユースケースの説明はあるが、どのモデル要素が責任を持つかが見えない
- ルールや不変条件が散文に埋もれ、モデルとの対応が取れない
- レビュー時に「この言葉は何を指すのか」が頻繁に議論になる

典型アンチパターン:

- 名詞の列挙だけで、振る舞いと制約が表現されていない
- 実装クラス名の集合をそのまま「ドメインモデル」と呼んでしまう
- 図は整っているが、業務ルールの根拠文書と結びついていない

改善アクション:

- ユースケースごとに関与する model element を明示する
- 業務ルールと不変条件を独立した一覧に切り出し、モデルへリンクする
- レビューで割れた概念は glossary と rule/invariant に戻して定義し直す

### 3.3 `ULI`: Ubiquitous Language Integrity

```text
ULI = 0.30*GC + 0.20*(1-AE) + 0.25*(1-TC) + 0.25*TL
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `GC` | glossary coverage | 定義した canonical term が実際に使われている |
| `AE` | alias entropy | 別名の乱立が少ない |
| `TC` | term collision rate | 同語異義の衝突が少ない |
| `TL` | traceability link coverage | 用語が文書とコードに追跡できる |

読み方:

- 高い `ULI` は「コンテキスト内で言葉が安定し、文書と実装を追える」状態です
- 低い `ULI` は、語彙の不統一だけでなく「用語はあるがコードへ辿れない」状態も含みます

DDD 上の注意:

- 全社で単語を完全統一することを目指す指標ではありません
- 大事なのは `全体統一` ではなく `コンテキスト内一貫性 + コンテキスト間翻訳可能性` です

current implementation の注意:

- `GC` は term の再出現、または code hit の有無から近似します
- `AE` は alias 数ベースの近似です
- `TL` は document hit と code hit の両方を持つ term 比率です
- CLI は構造的な語彙ノイズを減らすために、flag 名、artifact ID、snake_case 設定名などを候補から除外します

どうあるべきか:

- 各 Context の内部では canonical term が安定して使われる
- 別名が存在する場合でも、意図的な alias として管理されている
- 文書、モデル、コードの間で用語を辿れる

悪い兆候:

- 同じ概念に対して画面、API、コードで別名が乱立する
- 同じ語が Context ごとに別の意味を持つのに、翻訳境界が見えない
- glossary にある語がコード上で見つからない

典型アンチパターン:

- 全 Context で単語を無理に統一しようとして、かえって意味がぼやける
- 別 Context の型名をそのまま共有し、翻訳なしで流し込む
- 用語集はあるが更新されず、実装と言葉がずれていく

改善アクション:

- Context ごとに canonical term と alias を管理する
- cross-context 連携では Published Language、ACL、DTO、event 名を明示する
- glossary term から model / code / API への traceability を増やす

### 3.4 `BFS`: Boundary Fitness Score

```text
A(P) = Σ a_ij [same_context(i,j)] / Σ a_ij
R(P) = Σ r_ij [different_context(i,j)] / Σ r_ij
BFS = 0.50*A + 0.50*R
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `A` | 引き寄せる力の充足 | 一緒にあるべき要素が同じ Context にいる |
| `R` | 分ける力の充足 | 分けるべき要素が別 Context に分かれている |

読み方:

- 高い `BFS` は「同居させる理由」と「分離する理由」の両方に整合している状態です
- `A` だけ高いと大きすぎる Context の可能性があります
- `R` だけ高いと分割しすぎ、翻訳や連携が過剰な可能性があります

current implementation の入力:

- 用語の context 割当
- ルール、不変条件の context 割当
- use case signal
- ownership / security / separation signal
- contract usage と boundary leak
- model-to-code link

current implementation の注意:

- グラフ分割最適化そのものではなく、根拠 signal の局所化/分離度から `A` と `R` を作る実装です
- `context < 2` や ownership / security signal 不足時は `unknowns` が増えます

どうあるべきか:

- 同じ不変条件、同じライフサイクル、同じ利用者に強く結びつく要素は同じ Context に集まる
- ownership、security、compliance、change cadence が異なる要素は明確に分離される
- 境界の理由を言葉で説明でき、ドキュメントにも根拠が残っている

悪い兆候:

- あるユースケースを読むたびに複数 Context を行き来しないと責務が完結しない
- team boundary や security zone が違うのに、同じ内部型を頻繁に共有している
- 境界の理由を聞くと「なんとなくこのパッケージに置いた」となる

典型アンチパターン:

- 機能一覧をそのまま Context にしてしまう
- UI や API の都合だけで Context を切り、業務上の整合性要求を無視する
- 分けるべき理由があるのに shared module でつなぎ続ける

改善アクション:

- Context 境界ごとに attraction signal と separation signal を棚卸しする
- ownership / security / compliance を model 側へ明記する
- cross-context 参照や co-change の多い境界を優先して見直す

### 3.5 `AFS`: Aggregate Fitness Score

```text
AFS = 0.60*SIC + 0.40*(1-XTC)
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `SIC` | Strong Invariant Closure | 強い不変条件が単一責務境界に閉じている |
| `XTC` | Cross-Aggregate Transaction Need | 複数境界への atomic write 必要性が低い |

読み方:

- 高い `AFS` は「強整合が必要な責務が局所化されている」状態です
- 低い `AFS` は、境界が不変条件と噛み合っていない可能性を示します

current implementation の注意:

- 現状は Aggregate 定義が未整備な場合、`context を aggregate proxy` として扱います
- `SIC` は invariant が何 context にまたがるかで近似します
- `XTC` は strong consistency を示す文言を含む invariant から推定します
- つまり、現状の `AFS` は Aggregate 図が厳密に読めているというより、不変条件の局所性を先に測る設計です

どうあるべきか:

- 強い不変条件は1つの Aggregate で守れる
- write command は原則として単一 Aggregate の責務で完結する
- 長期プロセスで扱える制約と、即時整合が必要な制約が区別されている

悪い兆候:

- 重要な command が毎回複数 Aggregate への同時更新を要求する
- 「整合性のため仕方なく distributed transaction を使う」が常態化する
- Aggregate が巨大で、何でも入っているのに変更競合も多い

典型アンチパターン:

- Entity の集まりをそのまま Aggregate と見なす
- 強整合でなくてもよいルールまで Aggregate 内へ押し込む
- 逆に、即時整合が必要なルールを saga や後追い補償へ逃がしてしまう

改善アクション:

- 不変条件を strong / process に分けて棚卸しする
- command ごとに「どの Aggregate が同期責務を持つか」を整理する
- 複数 Aggregate を跨ぐ strong invariant が多い箇所から境界を見直す

### 3.6 `MCCS`: Model-to-Code Conformance Score

```text
MCCS = 0.50*MRP + 0.25*(1-BLR) + 0.25*CLA
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `MRP` | model-derived rule pass rate | 境界違反が少ない |
| `BLR` | boundary leak ratio | 内部型、内部実装への越境参照が少ない |
| `CLA` | contract language adherence | 契約 DTO、公開契約、イベント経由の連携が守られている |

読み方:

- 高い `MCCS` は「モデルが図面ではなく、コード上の規律として効いている」状態です
- 低い `MCCS` は、実装が境界を越えて内部に触れていることを示します

current implementation の注意:

- `MRP` は実質的に `1 - BLR` の近い proxy として振る舞います
- cross-context 参照自体が観測されない場合、値は悪く見えなくても `unknowns` が付きます
- `evidence` には boundary leak の検出結果が入ります

どうあるべきか:

- cross-context 連携は公開契約、契約 DTO、event、ACL のいずれかを通る
- 別 Context の内部実装や internal type を直接参照しない
- 設計上の禁止依存が CI で検出できる

悪い兆候:

- 便利だからという理由で別 Context の entity や service を直接 import している
- 契約 DTO を飛ばして内部モデルをそのまま返している
- 設計文書には境界があるのに、ビルドでは何も守られていない

典型アンチパターン:

- shared package を作って境界違反を隠す
- migration や test utility を入口に、内部型依存が本体コードへ広がる
- 「一時的な回避」が恒久化して boundary leak になる

改善アクション:

- cross-context import を検出する static rule を CI に入れる
- Published Language、ACL、契約 DTO へ連携経路を揃える
- leak finding が多い境界から、翻訳層と公開契約を先に整える

### 3.7 `ELS`: Evolution Locality Score

```text
ELS = 0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)
```

| 要素 | 意味 | 高いと何を示すか |
|---|---|---|
| `CCL` | cross-context change locality | 変更が単一 Context に留まりやすい |
| `FS` | feature scatter | 1変更あたりに跨る Context 数が少ない |
| `SCR` | surprise coupling ratio | 意外な co-change が少ない |

読み方:

- 高い `ELS` は「進化の単位」が設計境界に近いことを示します
- 低い `ELS` は、設計図上は分かれていても変更実態では密結合な可能性を示します

current implementation の注意:

- `git log --name-only` を正規化し、Context ごとの共変更を見ます
- policy profile の history filter で `^chore: format` と `^chore: bump dependencies`、lockfile が除外されます
- 履歴が 0 件、または少ないと `confidence` が下がり、`暫定値` の `unknowns` が出ます

どうあるべきか:

- 1つの feature / issue の変更は、原則として少数の Context で閉じる
- 変更のたびに同じ Context ペアが一緒に直される状態が少ない
- 設計図上の境界と、履歴上の進化単位が一致している

悪い兆候:

- PR ごとに毎回同じ複数 Context が同時に修正される
- 静的依存では見えないのに、履歴では高頻度で一緒に変わる組がある
- feature 単位の変更が広く散り、レビュー範囲が大きくなる

典型アンチパターン:

- 分割しただけで integration contract を整えず、毎回両側修正になる
- shared configuration や shared schema が hidden dependency になる
- bulk change をノイズ除去せず、そのまま locality の悪化として読んでしまう

改善アクション:

- co-change の高い boundary pair を洗い出し、契約の切り出しや再統合を検討する
- issue/feature 単位で触る Context 数を継続的に観測する
- formatter、rename、依存一括更新などの履歴ノイズを filter に入れる

### 3.8 ドメイン設計の総合指数

```text
DDFI_pre = 0.35*DRF + 0.20*ULI + 0.30*BFS + 0.15*AFS
DDFI_post = 0.20*DRF + 0.15*ULI + 0.20*BFS + 0.15*AFS + 0.10*MCCS + 0.20*ELS
```

読み方:

- `DDFI_pre` は greenfield で候補案比較に使う想定です
- `DDFI_post` は brownfield の時系列比較に使う想定です
- current implementation では、これらは文書仕様であり CLI の metric としてはまだ返りません

## 4. アーキテクチャ設計指標

### 4.1 全体像

アーキテクチャ側は、理論上の上位指標と current implementation の出力が1対1ではありません。

| 理論上の上位指標 | 役割 | current implementation の主な対応 |
|---|---|---|
| `QSF` | quality scenario fit | `QSF` |
| `PCS` | pattern conformance | `DDS`, `BPS`, `IPS` の proxy 合成 |
| `OAS` | operational adequacy | `OAS`、未観測時は `TIS` bridge |
| `EES` | evolution efficiency | `EES`、locality 側は `AELS` を利用 |
| `CTI` | complexity tax | `CTI` |
| `APSI` | summary index | `APSI` |

重要な注意:

- `APSI` は summary-only metric です
- `CTI` だけは低いほど望ましい指標です
- `APSI` の式では `1 - CTI` を使います

### 4.2 `QSF`: Quality Scenario Fit

```text
QSF = Σ(priority_s * n_s) / Σ(priority_s)
```

読み方:

- その設計が、対象システムの重要シナリオにどれだけ合っているかを示します
- パターン名への一般論評価ではなく、scenario に対する適合度です

current implementation の注意:

- `scenario-catalog` と `scenario-observations`、または `scenario-observation-source` を使う部分実装です
- 観測がない scenario は `unknowns` に出ます
- raw telemetry を直接読むのではなく、scenario 単位に正規化された観測を前提にします

どうあるべきか:

- 重要な quality scenario が明文化され、priority が付いている
- target と worst acceptable が scenario ごとに定義されている
- 観測値が scenario 単位に紐づき、設計案比較に使える

悪い兆候:

- 「速い」「安全」「変更しやすい」のような一般論だけで評価する
- どの scenario を重視するかが曖昧で、議論の前提が毎回変わる
- benchmark や incident があるのに scenario へ還元されていない

典型アンチパターン:

- パターン名そのものを採点する
- 指標はあるが target / worst がなく、良し悪しを比較できない
- priority のない scenario を大量に並べて意思決定できなくなる

改善アクション:

- top 10 scenario を決め、priority と response measure を付ける
- benchmark、incident、SLO を scenario observation に正規化する
- 候補案比較では QSF を最初に確認し、後続指標はその妥当化に使う

### 4.3 `PCS`: Pattern Conformance Score

```text
PCS = Σ(weight_r * result_r) / Σ(weight_r)
```

current implementation では、`PCS` 自体を直接返す代わりに、次の3指標を合成します。

#### `DDS`: Dependency Direction Score

```text
DDS = 0.60*(1-IDR) + 0.25*LRC + 0.15*APM
```

| 要素 | 意味 |
|---|---|
| `IDR` | illegal dependency ratio |
| `LRC` | layer rule compliance |
| `APM` | abstraction/path mapping coverage |

高いと、依存方向が constraints の layer rank に従っていることを示します。

#### `BPS`: Boundary Purity Score

```text
BPS = 0.45*(1-ALR) + 0.30*FCC + 0.25*(1-SICR)
```

| 要素 | 意味 |
|---|---|
| `ALR` | adapter leak ratio |
| `FCC` | framework contamination control |
| `SICR` | shared internal component ratio |

高いと、内部境界が framework や shared internal component に汚染されにくい状態を示します。

#### `IPS`: Interface Protocol Stability

```text
IPS = 0.50*CBC + 0.25*(1-BCR) + 0.25*SLA
```

| 要素 | 意味 |
|---|---|
| `CBC` | contract backward compatibility |
| `BCR` | breaking change risk |
| `SLA` | schema language adherence |

高いと、公開契約が安定し、内部実装依存が少ないことを示します。

current implementation の注意:

- `PCS` は report 上では supporting metrics を読む前提です
- `APSI` 内では `DDS/BPS/IPS` の weighted average を `PCS proxy` として使います
- したがって `APSI` の `PCS` は理論上の full rule set そのものではありません

どうあるべきか:

- パターンごとの禁止依存、契約規則、分離規則が明示されている
- その規則が static analysis や fitness function で継続評価される
- 「守っているつもり」ではなく、違反時に検出できる

悪い兆候:

- パターン名は決まっているが、何を守れば準拠なのかが定義されていない
- layer や port の名前だけあり、依存方向は自由になっている
- 契約が不安定でも、CI 上は何も検知しない

典型アンチパターン:

- package 構成だけで layered / hexagonal だと見なす
- shared internal component を増やして規律の破綻を隠す
- 契約ファイルと実装ファイルの区別が曖昧なまま運用する

改善アクション:

- pattern family ごとに rule set を明文化する
- dependency、cycle、contract stability を CI で評価する
- `DDS` `BPS` `IPS` のどこで崩れているかを分解して直す

### 4.4 `TIS`: Topology Isolation Score

```text
TIS = 0.40*FI + 0.30*RC + 0.30*(1-SDR)
```

| 要素 | 意味 |
|---|---|
| `FI` | failure isolation |
| `RC` | runtime containment |
| `SDR` | shared dependency ratio |

`TIS` は理論上の最終指標ではなく、current implementation では `OAS` を補う bridge 指標です。

高いと:

- 同期依存が isolation boundary をまたぎにくい
- shared resource 依存が少ない
- runtime containment が局所化している

どうあるべきか:

- failure isolation と runtime containment の境界が topology 上でも観測上でも説明できる
- shared resource が少なく、障害波及が抑えられている
- 同期呼び出しの深さが isolation boundary と整合している

悪い兆候:

- boundary をまたぐ同期呼び出しが多い
- 共有 DB や shared queue が広く使われ、分離が見かけだけになる
- runtime containment を表す observation がなく、意図が検証できない

改善アクション:

- topology model に isolationBoundary を明示する
- shared dependency を洗い出し、局所化か契約化を進める
- failure containment の観測をランタイム側で追加する

### 4.5 `OAS`: Operational Adequacy Score

```text
CommonOps = Σ(traffic_weight_b * band_score_b)
band_score_b = 0.45*LatencyScore_b + 0.35*ErrorScore_b + 0.20*SaturationScore_b
OAS = 0.50*CommonOps + 0.50*PatternRuntime
```

読み方:

- 本番挙動が、そのパターンの約束を満たしているかを見ます
- traffic 自体は得点対象ではなく、latency / error / saturation を層別化する条件です

current implementation の注意:

- `telemetry-observations`
- `telemetry-raw-observations + telemetry-normalization-profile`
- `telemetry-export`
- `telemetry-source`

の優先順位で観測を取り込みます。

さらに:

- `PatternRuntime` がない場合は `TIS` bridge を使います
- traffic band の一部 signal 欠損時は中立値や部分近似が混ざります

どうあるべきか:

- low / median / peak の traffic band ごとに latency / error / saturation が把握できる
- pattern-specific runtime metric も一緒に観測できる
- 本番の振る舞いが「そのパターンを採った理由」を裏切っていない

悪い兆候:

- CommonOps は良いが pattern runtime が悪く、パターン固有の約束が守れていない
- traffic band によって挙動が激変するのに、平均値でしか見ていない
- `OAS` が bridge や中立値に依存し、実測が少ない

典型アンチパターン:

- telemetry はあるが、設計評価に使える形へ正規化されていない
- pattern runtime の観測がなく、`TIS` で代用し続ける
- traffic をスコア対象にしてしまい、負荷の高低と健全性を混同する

改善アクション:

- telemetry を traffic band 付き canonical schema へ正規化する
- pattern family ごとの runtime 指標を最小セットで導入する
- `OAS` の `unknowns` が多い間は summary 判断に使いすぎない

### 4.6 `AELS`: Architecture Evolution Locality Score

```text
AELS = 0.40*(1-CrossBoundaryCoChange)
     + 0.30*(1-WeightedPropagationCost)
     + 0.30*(1-WeightedClusteringCost)
```

| 要素 | 意味 |
|---|---|
| `CrossBoundaryCoChange` | 境界またぎの共変更率 |
| `WeightedPropagationCost` | 変更伝播コスト |
| `WeightedClusteringCost` | change coupling の広がり |

高いと、変更が boundary 内に留まりやすい状態を示します。

current implementation の注意:

- `boundary-map` がない場合、`constraints.layers` を boundary proxy として使います
- 履歴が少ないと `AELS` は暫定値になります

どうあるべきか:

- architecture boundary 単位で co-change を読める
- propagation cost と clustering cost が低く、境界内変更で済みやすい
- service / module / layer の境界と履歴上の進化単位が揃っている

悪い兆候:

- 複数 boundary をまたぐ commit が常態化する
- 一部 boundary の組が毎回一緒に変わる
- boundary map がなく、constraints layer を proxy にし続ける

改善アクション:

- boundary map を明示して locality 分析の単位を固定する
- cross-boundary co-change の高い組を review 対象にする
- propagation cost の高い boundary は再分割か再統合を検討する

### 4.7 `EES`: Evolution Efficiency Score

```text
Delivery = 0.25*LeadTimeScore
         + 0.20*DeployFreqScore
         + 0.20*RecoveryScore
         + 0.20*(1-ChangeFailScore)
         + 0.15*(1-ReworkScore)

Locality = AELS 相当の locality score

EES = 0.60*Delivery + 0.40*Locality
```

読み方:

- delivery performance と、履歴上の変更局所性を合わせて見ます
- 片方だけ良くても十分ではありません

current implementation の注意:

- `delivery-observations`
- `delivery-raw-observations + delivery-normalization-profile`
- `delivery-export`
- `delivery-source`

の優先順位で Delivery を組み立てます。

どうあるべきか:

- lead time、deploy frequency、recovery、change fail、rework を継続観測できる
- delivery の改善と locality の改善が両立している
- 単に速く出せるだけでなく、変更失敗や手戻りが抑えられている

悪い兆候:

- deploy は多いが rework や failure が高い
- delivery は良いのに locality が悪く、実は大きな同期調整が必要
- delivery 観測が欠けて `EES` が部分近似のまま使われる

典型アンチパターン:

- DORA 指標だけで進化効率を見たつもりになる
- co-change を無視し、構造図だけで「変更しやすい」と判断する
- deployable を増やした結果、recovery や rework が悪化しても見ていない

改善アクション:

- delivery と locality を分けて監視し、どちらが律速かを見る
- `AELS` と併せて `EES` を読み、速度と局所性の両方を確認する
- raw delivery data がある場合は normalization profile を整えて取り込む

### 4.8 `CTI`: Complexity Tax Index

```text
CTI = 0.20*DeployablesPerTeam
    + 0.15*PipelinesPerDeployable
    + 0.15*ContractsOrSchemasPerService
    + 0.10*DatastoresPerServiceGroup
    + 0.15*OnCallSurface
    + 0.10*SyncDepthOverhead
    + 0.15*RunCostPerBusinessTransaction
```

読み方:

- 高いほど「そのパターンが追加で払わせる税」が大きいことを示します
- よい設計では `CTI` を下げつつ、`QSF` `OAS` `EES` を確保する必要があります

current implementation の注意:

- `complexity-export`、`complexity-source`、constraints metadata を使う部分実装です
- 一部 component は codebase-derived proxy です
- `OnCallSurface` や `RunCostPerBusinessTransaction` は metadata 不足になりやすく、`unknowns` が増えやすい指標です

どうあるべきか:

- 設計の利得に対して、運用税と認知税が過大でない
- deployable、pipeline、schema、datastore、on-call 面積が team capacity に見合っている
- 複雑性の増加が business volume や要求品質で説明できる

悪い兆候:

- 独立性を得たと言う一方で、運用面の coordination cost が急増する
- schema や pipeline が増えたが、品質や速度の改善に結びついていない
- on-call surface が膨らんでも、誰もその税を見ていない

典型アンチパターン:

- microservices や event-driven を導入し、CTI を見ずに成功と見なす
- deployable 数だけを増やして team capacity で正規化しない
- 実コストや on-call 面積を未観測のまま放置する

改善アクション:

- 最低でも deployables per team と on-call surface を観測する
- complexity metadata を constraints または export bundle に載せる
- `QSF` `OAS` `EES` の利得と並べて CTI を判断する

### 4.9 `APSI`: Architecture Pattern Suitability Index

```text
APSI = 0.30*QSF + 0.20*PCS + 0.20*OAS + 0.15*EES + 0.15*(1-CTI)
```

読み方:

- 意思決定の要約値です
- 単独で「この設計が良い」と判定してはいけません
- 必ず `QSF` `PCS proxy` `OAS` `EES` `CTI` を一緒に読みます

current implementation の注意:

- `PCS` は `DDS/BPS/IPS proxy`
- `OAS` 未観測時は `TIS` bridge fallback
- 未観測指標には中立値 `0.5` を使うことがある
- active profile に応じて重みが変わる

どうあるべきか:

- 下位指標を見たうえで、候補比較や時系列比較の要約として使う
- supporting metrics のどこが利得で、どこが税かを説明できる
- profile の重みが、比較したい pattern family と整合している

悪い兆候:

- `APSI` だけを見て設計採否を決める
- proxy や中立値が多いまま summary を強く信じる
- profile の違いを理解せず、数値だけ横比較する

典型アンチパターン:

- `APSI` を単一 KPI として運用する
- CTI を含めず、複雑な案ほど高得点に見せてしまう
- greenfield の想定値と brownfield の実測値を同じ重みで混ぜる

改善アクション:

- report では必ず supporting metrics を先に読む
- `unknowns` の多い summary は意思決定補助に留める
- pattern family に応じて profile を切り替え、比較条件を揃える

### 4.10 profile ごとの `APSI` 比較重み

| profile | 目的 |
|---|---|
| `default` | 汎用比較 |
| `layered` | `QSF` と `PCS` を厚く見る |
| `service_based` | `EES` と `CTI` を厚く見る |
| `cqrs` | `QSF` `OAS` `CTI` を厚く見る |
| `event_driven` | `OAS` と `CTI` を厚く見る |

具体的な式は `src/core/policy.ts` の preset を正とします。

## 5. 最初に見るべき最小セット

### 5.1 ドメイン設計

- `DRF`: `SC`, `RA`
- `ULI`: `AE`, `TC`
- `BFS`: `A`, `R`
- `AFS`: `SIC`
- `MCCS`: `BLR`
- `ELS`: `CCL`

### 5.2 アーキテクチャ設計

- `QSF`: top scenario の weighted score
- `DDS`: dependency direction
- `BPS`: boundary purity
- `OAS`: p95 latency / error / saturation by traffic band
- `EES`: lead time と change fail
- `AELS`: cross-boundary co-change
- `CTI`: deployables per team と on-call surface

## 6. この文書の読み方

迷ったときは、次の順に読むと把握しやすいです。

1. まず「何を良いとしたいか」を [../domains/domain-design.md](../domains/domain-design.md) または [../domains/architecture-design.md](../domains/architecture-design.md) で確認する
2. 次にこの文書で、各 metric が何を意味するかをざっと掴む
3. 実際の CLI の挙動は [../platform/analysis-mechanism.md](../platform/analysis-mechanism.md) で確認する
4. アーキテクチャ側の current/future のズレは [../domains/architecture-metric-mapping.md](../domains/architecture-metric-mapping.md) を見る
