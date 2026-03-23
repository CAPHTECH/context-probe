# ポリシー設定とCI運用

## 1. 目的

この文書は、指標式、閾値、レビュー条件、差分検査、監査運用をどのように扱うかを定義する。

## 2. ポリシー設定方針

設計計測の意思決定は、コードに埋め込まず設定ファイルで管理する。

- 指標式
- 閾値
- レビュー必須条件
- 除外ルール
- ノイズ履歴フィルタ
- 差分スキャン対象

## 3. ポリシープロファイル例

```yaml
profiles:
  default:
    domains:
      domain_design:
        metrics:
          MCCS:
            formula: "0.50*MRP + 0.25*(1-BLR) + 0.25*CLA"
            thresholds:
              warn: 0.70
              fail: 0.55
          ELS:
            formula: "0.40*CCL + 0.30*(1-FS) + 0.30*(1-SCR)"
            thresholds:
              warn: 0.68
              fail: 0.50
        review:
          require_human_if:
            - "confidence < 0.75"
            - "unknowns_count > 0"
            - "collision == true"
      architecture_design:
        metrics:
          DDS:
            formula: "0.60*(1-IDR) + 0.25*LRC + 0.15*APM"
            thresholds:
              warn: 0.72
              fail: 0.58
        review:
          require_human_if:
            - "confidence < 0.80"
            - "breaking_change_detected == true"
    history_filters:
      ignore_commit_patterns:
        - "^chore: format"
        - "^chore: bump dependencies"
      ignore_paths:
        - "package-lock.json"
        - "pnpm-lock.yaml"
```

## 4. CIシナリオ

### 4.1 ドメイン設計向け

- 新規 `boundary leak` が増えたら fail
- `BLR` が基準値を超えたら warn または fail
- 新しい `term collision` は自動承認せず review 必須
- `MCCS` の悪化が閾値以上なら fail

### 4.2 アーキテクチャ設計向け

- 新しい依存方向違反が増えたら fail
- 破壊的契約変更が検出されたら review 必須
- `DDS` や `BPS` の急落を警告する
- shared runtime dependency の増加を通知する

## 5. 実行モード

| モード | 用途 |
|---|---|
| `pre_merge_diff` | PR単位の差分チェック |
| `nightly_full` | 夜間フルスキャン |
| `release_gate` | リリース前の基準確認 |
| `candidate_compare` | 設計案比較 |

## 6. ベースライン運用

### 6.1 ベースラインの役割

- 「絶対に何点か」より「前回より悪化したか」を判断する基準になる
- リファクタリング施策の効果確認に使う

### 6.2 ベースライン保存単位

- main ブランチの日次スナップショット
- リリース時点の固定スナップショット
- 設計案比較用のスナップショット

## 7. レビュー運用

### 7.1 人手レビュー必須の典型条件

- `confidence` が基準未満
- `unknowns` が空でない
- 用語衝突や分類曖昧性がある
- ownership / security 情報が不足している
- 破壊的契約変更が疑われる

### 7.2 レビューの記録

レビュー結果は必ず構造化して残す。

- 対象 `review_item_id`
- 判定
- 理由
- 修正内容
- 判定者
- 時刻

## 8. 監査と安全性

### 8.1 監査ログ

最低限、次を記録する。

- どの入力を使ったか
- どのポリシープロファイルを使ったか
- どのコマンドを実行したか
- どのレビュー結果が反映されたか

### 8.2 機密保護

- 外部送信を行わないローカル実行モードを持つ
- 機密文書を扱う場合は送信禁止ポリシーを選択できる
- provenance には、必要以上の機密本文を残さない

## 9. 誤検知との付き合い方

誤検知をゼロにすることではなく、誤検知が起きたときに扱えることを重視する。

- ignore ルールを明示的に登録できる
- review で修正した結果を再計測へ反映できる
- 誤検知理由を evidence 付きで追跡できる
