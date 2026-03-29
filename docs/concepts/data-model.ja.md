# 標準データモデル

## 1. 目的

この文書は、評価領域をまたいで共有する標準エンティティと、それぞれの関係を定義する。

## 2. 主要エンティティ

| エンティティ | 説明 |
|---|---|
| `Artifact` | 文書、コード、履歴、図、運用データなどの入力単位 |
| `Fragment` | 文書やコードの参照可能な断片 |
| `EvaluationDomain` | ドメイン設計、アーキテクチャ設計などの評価領域 |
| `Term` | canonical term または alias |
| `Rule` | 業務ルール、設計ルール、制約 |
| `Invariant` | 強い不変条件またはプロセス不変条件 |
| `ModelElement` | Context、Aggregate、Layer、Service、Contractなどのモデル要素 |
| `Evidence` | スコアや判断の根拠 |
| `Finding` | 問題検出結果 |
| `MetricDefinition` | 指標の式と意味 |
| `MetricScore` | 実際に算出された指標値 |
| `ReviewItem` | 人手判断が必要な項目 |
| `MeasurementRun` | 1回の計測実行 |
| `Baseline` | 比較基準となる過去スナップショット |

## 3. ID設計

- すべてのエンティティは安定したIDを持つ
- 同じ入力を再取り込みした場合も、内容が同一なら同じIDになることを目指す
- IDの生成元は provenance と一緒に保存する

例:

- `ART-0001`
- `FRG-doc-20-p-44`
- `TERM-Customer`
- `RULE-R-014`
- `EV-1022`
- `RUN-20260320-001`

## 4. Artifact

```json
{
  "artifact_id": "ART-0001",
  "type": "document",
  "source_kind": "git_file",
  "path": "docs/domain/order.md",
  "revision": "abc1234",
  "collected_at": "2026-03-20T04:00:00Z",
  "domain_tags": ["domain_design"],
  "provenance": {
    "repository": "repo-main",
    "branch": "main"
  }
}
```

## 5. Fragment

```json
{
  "fragment_id": "FRG-doc-20-p-44",
  "artifact_id": "ART-0001",
  "kind": "paragraph",
  "locator": {
    "path": "docs/domain/order.md",
    "line_start": 120,
    "line_end": 126
  },
  "text": "注文確定後は決済総額と明細合計が常に一致していなければならない"
}
```

## 6. EvaluationDomain

```json
{
  "domain_id": "domain_design",
  "name": "ドメイン設計評価",
  "version": "0.1",
  "status": "active"
}
```

## 7. Evidence

```json
{
  "evidence_id": "EV-1022",
  "type": "document_fragment",
  "source": {
    "artifact_id": "ART-0001",
    "fragment_id": "FRG-doc-20-p-44",
    "path": "docs/domain/order.md"
  },
  "statement": "注文確定後は決済総額と明細合計が常に一致していなければならない",
  "linked_entities": ["RULE-R-014", "MODEL-AGG-Order"],
  "confidence": 0.89
}
```

## 8. Finding

```json
{
  "finding_id": "BL-0031",
  "domain_id": "domain_design",
  "severity": "high",
  "type": "direct_internal_type_reference",
  "summary": "Fulfillment から Billing の internal type を直接参照している",
  "evidence_refs": ["EV-2041"],
  "provenance": [
    {
      "artifact_id": "ART-0100",
      "path": "src/fulfillment/FulfillmentService.kt",
      "line": 128
    }
  ]
}
```

## 9. MetricDefinition

```json
{
  "metric_id": "MCCS",
  "domain_id": "domain_design",
  "name": "Model-to-Code Conformance Score",
  "formula": "0.50*MRP + 0.25*(1-BLR) + 0.25*CLA",
  "components": ["MRP", "BLR", "CLA"],
  "range": [0.0, 1.0]
}
```

## 10. MetricScore

```json
{
  "metric_id": "MCCS",
  "run_id": "RUN-20260320-001",
  "value": 0.78,
  "components": {
    "MRP": 0.84,
    "BLR": 0.12,
    "CLA": 0.81
  },
  "evidence_refs": ["BL-0031", "EV-1022"],
  "confidence": 0.93,
  "unknowns": []
}
```

## 11. ReviewItem

```json
{
  "review_item_id": "RV-0008",
  "domain_id": "domain_design",
  "reason": "term_collision",
  "summary": "Customer が CRM と Billing で同一概念か未確定",
  "candidate_entities": ["TERM-Customer"],
  "evidence_refs": ["EV-3001", "EV-3002"],
  "confidence": 0.62,
  "status": "open"
}
```

## 12. MeasurementRun

```json
{
  "run_id": "RUN-20260320-001",
  "mode": "baseline_compare",
  "domains": ["domain_design"],
  "artifacts": ["ART-0001", "ART-0100"],
  "policy_profile": "default",
  "started_at": "2026-03-20T04:00:00Z",
  "completed_at": "2026-03-20T04:08:30Z",
  "baseline_run_id": "RUN-20260319-004"
}
```

## 13. 関係モデル

基本的な関係は次の通り。

```text
Artifact -> Fragment -> Evidence
Evidence -> Finding
Evidence -> MetricScore
EvaluationDomain -> MetricDefinition
MeasurementRun -> MetricScore
ReviewItem -> Evidence
```

## 14. 設計上の注意

1. `Evidence` は原則として元ソースに戻れること
2. `Finding` と `Evidence` を分けること
   - `Evidence` は根拠
   - `Finding` は根拠を束ねた判断結果
3. `MetricScore` は構成要素へ分解可能であること
4. `ReviewItem` は未確定事項を隠さず保存すること
