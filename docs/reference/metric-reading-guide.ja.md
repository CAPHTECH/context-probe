# 指標の読み方ガイド

個別の metric を読む前に、この文書を読むことを前提にします。

この文書では次を整理します。

- `score` `confidence` `unknowns` をどう分けて読むか
- summary metric をいつ使ってよいか
- 数式と閾値の正本がどこにあるか
- 概念、読み方、current implementation のどこを次に読めばよいか

## 文書の役割分担

文書は意図的に次のように分けています。

- `concepts/`: 概念モデルと数式
- `reference/`: 人間向けの読み方
- `implementation/`: current implementation の挙動、proxy、source precedence、report/gate 反映

`implementation/` で metric の意味を再定義しないこと。
`concepts/` から current implementation の fallback や precedence を推測しないこと。

## 読む順番

1つの metric について、次の順で読むと混同しにくくなります。

1. concept: 何を測るつもりか
2. reference: 高い/低い値をどう解釈するか
3. implementation: current implementation が実際にどう計算しているか

## `score` `confidence` `unknowns` を分けて読む

### `score`

観測できた入力から計算した算術結果です。

- `0.0` は観測範囲内で大きな不適合がある状態
- `1.0` は観測範囲内で強い適合が見られる状態

### `confidence`

その結果をどれだけ信頼できるかです。

低くなりやすい典型要因:

- evidence が薄い
- Git 履歴が少ない
- proxy や fallback を使っている
- extraction / normalization 後も曖昧さが残っている

### `unknowns`

ツールが確認できなかった事項です。

脚注ではなく、結果の本体として読みます。
`status=ok` でも重要な `unknowns` が残ることがあります。

## Summary Metric を単独判定に使わない

summary metric を使ってよいのは次の比較です。

- 同一プロダクト内の候補案比較
- 同一コードベースの before / after 比較
- 同一システムの時系列比較

組織横断ランキングには使いません。

current implementation で関係する summary metric:

- `DDFI_pre`
- `DDFI_post`
- `APSI`

特に `APSI` は supporting metrics に proxy / partial が混ざり得るため、単独で読まないことが重要です。

## 概念仕様と current implementation は分けて読む

概念モデルと current implementation が 1 対 1 で対応しない metric があります。
proxy / bridge / partial 実装の有無が判断に影響する場合は、必ず implementation 文書を確認します。

- `domain_design`: [../implementation/domain-design-measurement.ja.md](../implementation/domain-design-measurement.ja.md)
- `architecture_design`: [../implementation/architecture-design-measurement.ja.md](../implementation/architecture-design-measurement.ja.md)

## 数式と閾値の正本

次の順で見るのを原則にします。

1. 概念上の数式: `concepts/`
2. active policy と threshold: `fixtures/policies/default.yaml` と `src/core/policy.ts`
3. current implementation の解析経路: `implementation/`

report と concept 文書が噛み合わない場合は、現在の挙動は implementation、意図された意味は concepts を正として読む。

## 次に読む文書

- 共通概念: [../concepts/measurement-model.ja.md](../concepts/measurement-model.ja.md)
- ドメイン設計指標: [domain-design-metrics.ja.md](domain-design-metrics.ja.md)
- アーキテクチャ設計指標: [architecture-design-metrics.ja.md](architecture-design-metrics.ja.md)
- 実行パイプラインとコマンド体系: [../implementation/runtime-and-commands.ja.md](../implementation/runtime-and-commands.ja.md)
