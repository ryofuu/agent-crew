---
id: TICKET-030
title: "crew tasks コマンド: 依存関係付きタスク一覧表示"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [cli]
estimated_complexity: S
---

# TICKET-030: crew tasks コマンド: 依存関係付きタスク一覧表示

## Description

タスクの依存関係と完了状況を一覧で確認できる `crew tasks` コマンドを追加。ステータスアイコン、依存元タスクID、未解決依存の警告を表示する。

## Acceptance Criteria

- [x] `crew tasks` コマンドを追加
- [x] 完了数/総数のサマリー表示
- [x] ステータス別の件数サマリー
- [x] ステータス順（active → waiting → done）でソート
- [x] 依存元タスクIDを `← TASK-001,TASK-002` 形式で表示
- [x] 未解決依存がある todo タスクに `(waiting: TASK-xxx)` を表示

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/tasks.ts` | new | タスク一覧コマンド |
| `src/cli/index.ts` | modified | tasks コマンド登録 |
