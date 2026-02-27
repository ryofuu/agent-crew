---
id: TICKET-031
title: "Planner: 全タスク完了時に最終動作確認タスクを自動作成"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [template]
estimated_complexity: S
---

# TICKET-031: Planner: 全タスク完了時に最終動作確認タスクを自動作成

## Description

PRD の全タスクが closed になった後、Planner が「最終動作確認」タスクを1枚作成して Reviewer に検証を依頼する仕組みを追加。status を `dev_done` にして Reviewer が直接ピックアップできるようにする。

PRD に書かれていないタスクを無理に作り出さず、全タスク完了 = 最終確認のみで工程終了とする。

## Acceptance Criteria

- [x] Step 0 ファストパスで全タスク closed 時に最終動作確認タスクの有無を判定
- [x] 最終動作確認タスクがなければ自動作成（status: dev_done, labels: [verification]）
- [x] 最終動作確認タスクのテンプレートを定義（Acceptance Criteria に UI/API/テスト確認を含む）
- [x] 最終動作確認タスクが closed なら全工程完了として Step 6 へ

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/planner.md` | modified | Step 0 に最終動作確認判定、テンプレートセクション追加 |
