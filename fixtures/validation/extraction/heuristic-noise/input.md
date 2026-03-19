# ノイズ除去

実際に拾いたい用語は `EvidenceCard` である。

証拠は常に追跡可能でなければならない。
evidence_id は常に一意である。

| Column | Value |
| --- | --- |
| TABLE_NOISE | should not become a term |

```yaml
NOISE_BLOCK: true
NOISE_RULE: must not be extracted
NOISE_INVARIANT: always true
```
