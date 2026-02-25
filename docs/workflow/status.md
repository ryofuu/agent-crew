# Workflow Status Board

**Current Phase**: Plan（チケット作成完了、Implement 待ち）
**Updated**: 2026-02-25T00:00:00+09:00
**Goal**: agent-crew Phase 1 MVP 実装（dev-cycle ワークフロー最小動作版）

## Ticket Summary

| Status | Count |
|--------|-------|
| todo | 8 |
| in_progress | 0 |
| blocked | 0 |
| dev_done | 0 |
| in_review | 0 |
| closed | 0 |

## Active Work

| Ticket | Title | Assignee | Status | Priority |
|--------|-------|----------|--------|----------|
| TICKET-001 | プロジェクト初期化 (package.json/tsconfig/biome) | - | todo | critical |
| TICKET-002 | Shared Kernel: 型定義と Result<T,E> | - | todo | critical |
| TICKET-003 | Task Store Module | - | todo | high |
| TICKET-004 | Workflow Engine Module | - | todo | high |
| TICKET-005 | Agent Runner Module | - | todo | high |
| TICKET-006 | CLI Module (crew コマンド全体) | - | todo | high |
| TICKET-007 | dev-cycle テンプレート + AGENTS.md | - | todo | medium |
| TICKET-008 | 統合テスト (E2E) | - | todo | medium |

## Dependency Graph

```
TICKET-001 (プロジェクト初期化)
  └─ TICKET-002 (Shared Kernel)
       ├─ TICKET-003 (Task Store)    ─────┐
       ├─ TICKET-004 (Workflow Engine) ───┼─ TICKET-006 (CLI)
       └─ TICKET-005 (Agent Runner)  ─────┘    └─ TICKET-008 (統合テスト)
                                                │
TICKET-004 ─┐                                  │
TICKET-005 ─┴─ TICKET-007 (Templates/AGENTS) ──┘
```

**並列可能**: TICKET-003 / TICKET-004 / TICKET-005 は同時着手可能

## Blockers

(none)

## Phase History

| Phase | Started | Completed | Notes |
|-------|---------|-----------|-------|
| Plan | 2026-02-25 | 2026-02-25 | 8チケット作成完了 |
