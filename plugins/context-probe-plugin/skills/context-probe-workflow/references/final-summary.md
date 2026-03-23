# Final Summary

Use this structure to close a `context-probe` workflow.

## Summary Format

```text
Measurement scope:
- what was measured
- which command path was used

High-confidence takeaways:
- strongest supported observations

Open unknowns:
- remaining gaps
- review items or low-confidence areas

Recommended next actions:
- rerun, review, docs update, boundary fix, or policy follow-up

Issue confirmation:
- ask whether the user wants to turn the findings into issues
```

## Rules

- Keep the summary concise.
- Separate confirmed observations from unresolved gaps.
- Mention evidence quality when it materially changes trust.
- If suggesting issue creation, stop at confirmation.
- Do not create issues automatically in this workflow.

## Good Closing Behavior

- If findings are weak or ambiguous, say so directly.
- If results are strong enough for action, say what should happen next.
- If the user wants issues, offer to draft issue titles and bodies in a follow-up step.
