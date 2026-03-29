# アーキテクチャ設計指標

この文書は `architecture_design` の指標を人間が読むための参照文書です。

概念上の数式は [../concepts/architecture-design.ja.md](../concepts/architecture-design.ja.md)、current implementation の挙動や proxy は [../implementation/architecture-design-measurement.ja.md](../implementation/architecture-design-measurement.ja.md) を参照します。

## 全体像

| 指標 | 主に見たい問い |
|---|---|
| `QSF` | この設計は、そのシステムに重要な quality scenario に合っているか |
| `PCS` | 実装は選んだ pattern の規律を守っているか |
| `OAS` | 実行時挙動はその pattern の約束を満たしているか |
| `EES` | delivery performance と変更局所性は両方とも健全か |
| `CTI` | 複雑性税は得られる利得に見合っているか |
| `APSI` | supporting metrics を読んだ後で、候補間比較の要約値としてどう使うか |

## `QSF`

そのシステムにとって重要な quality scenario に対する適合度を見ます。

良い状態:

- top scenario に優先度が付いている
- target と worst acceptable が定義されている
- 観測値が scenario に結び付いている

悪い兆候:

- pattern の好みだけで議論している
- target や worst-case bound がない
- scenario が多いのに優先度がない

次の改善:

- まず top scenario を絞る
- benchmark、SLO、incident を scenario observation に正規化する

## `PCS`

選択したアーキテクチャパターンの規律が本当に守られているかを見ます。

良い状態:

- pattern 固有のルールが明示されている
- そのルールが継続的に検査される
- 違反が観測できる

悪い兆候:

- pattern 名だけがあり、守るべきルールがない
- package 構成だけ整っていて実際の制約が弱い
- contract drift を CI が検知しない

次の改善:

- pattern family ごとに rule set を定義する
- dependency direction、purity、contract stability を分けて評価する

## `OAS`

実行時挙動が、その pattern を採った理由を裏切っていないかを見ます。

良い状態:

- traffic band ごとに latency、error、saturation が見える
- pattern 固有の runtime signal も観測できる
- 本番挙動が設計意図を損なわない

悪い兆候:

- generic ops は良いが pattern runtime が弱い
- bridge や中立値に依存している

次の改善:

- telemetry を traffic band ごとに正規化する
- pattern-specific runtime の最小観測セットを追加する

## `EES`

delivery performance と履歴上の変更局所性を合わせて見ます。

良い状態:

- lead time、recovery、change fail が健全
- locality も健全

悪い兆候:

- 速く出せるが広い同期変更を必要とする
- delivery signal は良いのに locality が悪い

次の改善:

- delivery と locality を分けて見る
- cross-boundary co-change の高い組を点検する

## `CTI`

その設計が追加で払わせる運用税・認知税を見ます。

良い状態:

- deployable、pipeline、schema、datastore、on-call 面積、sync depth、run cost がチーム能力と業務必要性に見合っている

悪い兆候:

- 利得が小さいのに coordination cost だけ増える
- on-call や schema burden が見えないまま増える

次の改善:

- まず deployables per team と on-call surface を測る
- complexity metadata を evidence 入力へ載せる

## Supporting Metrics

current implementation では、次の supporting metric が分離表示されることがあります。

- `DDS`: dependency direction
- `BPS`: boundary purity
- `IPS`: interface stability
- `TIS`: topology-isolation bridge
- `AELS`: architecture change locality

`contract-baseline` を渡した場合、`IPS` の `CBC` / `BCR` はその baseline との差分として読みます。渡さない場合は current-state heuristic のままです。

`APSI` を読む前に、これらを先に見ます。

## `APSI`

`APSI` は summary-only の比較補助値です。

必ず次を先に読んでから使います。

- `QSF`
- `PCS` またはその supporting metrics
- `OAS`
- `EES`
- `CTI`

単独 KPI として使わないこと。
