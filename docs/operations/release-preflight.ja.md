# Release Preflight

この runbook は、このリポジトリの release 前に何を回すかを固定するものです。

## いつ何を回すか

- `npm run check` を回して、静的解析の回帰を先に潰します。
- `npm run test:coverage` を回して、テストと branch coverage の基準を確認します。
- `npm run self:architecture:check` を回して、review 済みの architecture snapshot を確認します。
- `npm run build` を回して、release artifact を問題なく生成できるか確認します。
- `npm pack --dry-run` を回して、publish される内容を確認します。

## 標準の release 順序

```bash
npm run check
npm run test:coverage
npm run self:architecture:check
npm run build
npm pack --dry-run
```

## この手順で確認すること

- `check` は type-check、Biome、dependency-cruiser、Knip をまとめて見ます。
- `test:coverage` は test suite と coverage gate を確認します。
- `self:architecture:check` は freshness drift と architecture score smoke を確認します。
- `build` は release artifact を生成できるか確認します。
- `npm pack --dry-run` は publish 対象に入るファイルを確認します。

## 関連文書

- ポリシー設定と CI 運用: [policy-and-ci.ja.md](policy-and-ci.ja.md)
- Self-measurement runbook: [self-measurement-runbook.ja.md](self-measurement-runbook.ja.md)
