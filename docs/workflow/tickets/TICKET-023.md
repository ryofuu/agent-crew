---
id: TICKET-023
title: "テンプレート改善: Planner ready上限3枚 & Phase→Step統一"
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

# TICKET-023: テンプレート改善: Planner ready上限3枚 & Phase→Step統一

## Description

Planner テンプレートの ready 制限緩和と、全ロールテンプレートの見出しスタイル統一。

## Acceptance Criteria

- [x] Planner: ready/changes_requested が残っていてもブロックせず、一度に最大3枚を ready にできる
- [x] 全テンプレート (planner, implementer, reviewer): "Phase N" → "Step N" に統一
- [x] GOTO 参照・本文の「フェーズ」→「ステップ」も修正

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/planner.md` | modified | Phase→Step、ready 制限の緩和 |
| `templates/agents/implementer.md` | modified | Phase→Step |
| `templates/agents/reviewer.md` | modified | Phase→Step |
