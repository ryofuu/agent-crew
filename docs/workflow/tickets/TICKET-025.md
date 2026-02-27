---
id: TICKET-025
title: "Reviewer: 判定基準の明示化 & 動作確認ステップ追加"
status: closed
assignee: ""
priority: high
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [template]
estimated_complexity: S
---

# TICKET-025: Reviewer: 判定基準の明示化 & 動作確認ステップ追加

## Description

Reviewer が全タスクを closed にしてしまい changes_requested が一度も出ない問題への対策。判定基準を明示し、動作確認ステップを追加。

### 問題の原因

- `/crew-parallel-review` にすべて委任しており、何を基準に changes_requested にするかが未定義だった
- BLOCKED ステータスは不要（問題があれば全部 changes_requested で差し戻す）

## Acceptance Criteria

- [x] 判定を APPROVED / CHANGES_REQUESTED の2択に簡素化（BLOCKED 削除）
- [x] changes_requested にすべき具体例を列挙（AC未充足、テスト不足、バグ、規約違反等）
- [x] closed にしてよい条件を明示
- [x] `/crew-parallel-review` は Feedback を書くだけ、最終判定は Reviewer 自身が行う旨を明記
- [x] Step 4「動作確認」追加: UI → Chrome DevTools MCP、API → curl、ロジックのみ → テストで十分
- [x] 禁止事項に「判定基準を満たさないのに closed にする」を追加

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/reviewer.md` | modified | 判定基準テーブル、具体例、動作確認ステップ追加、BLOCKED 削除 |
