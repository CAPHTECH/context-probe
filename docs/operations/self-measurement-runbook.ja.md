# Self-Measurement Runbook

この runbook は、このリポジトリで architecture self-measurement を回すときの運用順序を固定するものです。

## いつ何を回すか

- measured / derived input が古そうなら `npm run self:architecture:refresh` を回す
- curated な complexity snapshot を更新したら `npm run self:architecture:complexity` を回す
- `IPS` の比較基準を意図的に更新したいときだけ `npm run self:architecture:baseline` を回す
- ローカルや CI で self-measurement の結果を使う前に `npm run self:architecture:check` を回す

## 標準の更新順序

```bash
npm run self:architecture:refresh
npm run self:architecture:complexity
npm run self:architecture:baseline   # optional かつ intentional
npm run self:architecture:check
```

## 品質ゲート

- `npm run check`
- `npm run test:coverage`
- `npm run self:architecture:check`

`test:coverage` は CI quality gate のローカル版です。`self:architecture:check` は reviewed architecture snapshot に対する運用チェックです。

## snapshot の役割

- `scenario-observations`: ローカル benchmark から作る measured input
- `boundary-map`: constraints から導出する derived input
- `architecture-complexity-snapshot.yaml`: curated な source of truth
- `architecture-complexity-export.yaml`: complexity snapshot から生成する derived artifact
- `architecture-contract-baseline.yaml`: `IPS` の intentional な comparison point
- telemetry / pattern runtime / delivery snapshots: curated observation input

## 想定どおり残る limitation

このリポジトリは small CLI codebase なので、次の architecture unknown は自己計測上の limitation として残りえます。

- `ALR`
- `FCC`
- `SICR`
- `SLA`
- `PCS` proxy composite

明確な反証がない限り、まずは defect ではなく self-measurement caveat として読みます。
