# Self-Measurement Domain Evidence

この文書は、`context-probe` がこのリポジトリを measurement product として自己計測するときに使う maintained domain evidence を定義する。

## Core Use Cases

Use case: maintainer が release 判断の前に `domain_design` の `score.compute` を実行する。MeasurementPipeline aggregate は、scoring を開始する前に maintained domain model、document evidence、active policy を読み込まなければならない。

Use case: maintainer が 1 回の score run の後で `report.generate` を実行する。ReportGeneration aggregate は、完了した run が生成した metrics、evidence references、measurement-quality summary、runtime metadata をそのまま render しなければならない。

Use case: maintainer が次に改善すべき evidence を決めるために `review.list_unknowns` を実行する。ReviewQueue aggregate は、missing curated inputs、proxy-heavy metrics、low-confidence items、history hotspots を ordered review queue で可視のまま保たなければならない。

Use case: maintainer が release 前の CI で `gate.evaluate` を実行する。PolicyDecision aggregate は、scored metrics を active policy に照らして評価し、対応する gate reasons を返さなければならない。

## Aggregate Ownership

MeasurementPipeline aggregate は `score.compute` の 1 回の scoring run を所有する。

ReportGeneration aggregate は `report.generate` の 1 回の rendering run を所有する。

ReviewQueue aggregate は `review.list_unknowns` の 1 回の ordered unknown-review queue を所有する。

PolicyDecision aggregate は `gate.evaluate` の 1 回の gate evaluation を所有する。

## Curated Terms

`Measurement Quality` (`measurementQuality`) は、score / report / gate / review の出力に付く run-level の evidence-quality summary である。

`Runtime Summary` (`runtime`) は、1 回の command run に付随する stage-based runtime metadata である。

`Scenario Quality` (`scenarioQuality`) は、architecture input に対する curated な scenario-health summary である。

`Locality Watchlist` (`localityWatchlist`) は、architecture report / review に持ち込まれる prioritized な cross-boundary co-change watchlist である。

## Strong Invariants

MeasurementPipeline aggregate では、metric scores と measurement-quality summary は常に一致している。

MeasurementPipeline aggregate では、status、confidence、unknowns、provenance は常に一致している。

ReportGeneration aggregate では、rendered report sections と、それが参照する metric outputs は常に一致している。

ReviewQueue aggregate では、review ordering と rendered action categories は常に一致している。

PolicyDecision aggregate では、gate status と gate reasons は常に一致している。
