---
id: TICKET-028
title: "Planner ファストパス: changes_requested 時のPRD読み込みスキップ"
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

# TICKET-028: Planner ファストパス: changes_requested 時のPRD読み込みスキップ

## Description

Planner が毎回PRDをフル読み込みして遅い問題。changes_requested のタスクがあるだけならPlannerの出番はなく、即完了通知でImplementerに渡せばよい。

## Acceptance Criteria

- [x] Step 0 にファストパス判定を追加
- [x] changes_requested あり & ready化できるtodoなし → Step 5/6 へスキップ
- [x] active タスク3つ以上 & ready化できるtodoなし → 同様にスキップ

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/planner.md` | modified | Step 0 ファストパス判定を追加 |
