# Workflow Status Board

**Current Phase**: Review R3 完了 → TICKET-008 (統合テスト) 待ち
**Updated**: 2026-02-25T17:00:00+09:00
**Goal**: agent-crew Phase 1 MVP 実装（dev-cycle ワークフロー最小動作版）

## Ticket Summary

| Status | Count |
|--------|-------|
| todo | 1 |
| in_progress | 0 |
| blocked | 0 |
| dev_done | 0 |
| changes_requested | 0 |
| in_review | 0 |
| closed | 7 |

## Active Work

| Ticket | Title | Assignee | Status | Priority | Review |
|--------|-------|----------|--------|----------|--------|
| TICKET-001 | プロジェクト初期化 (package.json/tsconfig/biome) | implementer-1 | closed | critical | APPROVED (R1) |
| TICKET-002 | Shared Kernel: 型定義と Result<T,E> | implementer-1 | closed | critical | APPROVED (R1) |
| TICKET-003 | Task Store Module | implementer-1 | closed | high | APPROVED (R3) |
| TICKET-004 | Workflow Engine Module | implementer-1 | closed | high | APPROVED (R3) |
| TICKET-005 | Agent Runner Module | implementer-1 | closed | high | APPROVED (R2) |
| TICKET-006 | CLI Module (crew コマンド全体) | implementer-1 | closed | high | APPROVED (R3) |
| TICKET-007 | dev-cycle テンプレート + AGENTS.md | implementer-1 | closed | medium | APPROVED (R1) |
| TICKET-008 | 統合テスト (E2E) | - | todo | medium | - |

## Dependency Graph

```
TICKET-001 (プロジェクト初期化) ✅
  └─ TICKET-002 (Shared Kernel) ✅
       ├─ TICKET-003 (Task Store) ✅ APPROVED (R3)
       ├─ TICKET-004 (Workflow Engine) ✅ APPROVED (R3)
       └─ TICKET-005 (Agent Runner) ✅ APPROVED (R2)
            ├─ TICKET-006 (CLI) ✅ APPROVED (R3)
            └─ TICKET-007 (Templates/AGENTS) ✅
                 └─ TICKET-008 (統合テスト) ⏳ todo
```

## Quality Gate (R3)

- **TypeScript**: `bun tsc --noEmit` ✅ 0 errors
- **Biome lint**: `bun run lint` ✅ 0 errors
- **Tests**: `bun test` ✅ 82 pass, 0 fail

## R3 Review Summary

全3チケット APPROVED。Critical/High の問題なし。

### TICKET-003 — APPROVED
- R2 Required Changes（create() に validateTaskId 追加）を確認。全パブリックメソッドで getTaskFilePath 到達前に ID バリデーション保証
- 残存 medium: public getTaskFilePath の throw（到達不能だが規約違反）、defensive validateTaskId のコメント不足
- 後続推奨: TaskFrontmatterSchema/TaskFrontmatter 二重定義の z.infer 統一、nextId() TOCTOU 対応

### TICKET-004 — APPROVED
- R2 Required Changes（WorkflowEnginePort 分離、evaluateLoopOrClose エラー永続化）を確認
- 残存 medium: writeState Result 破棄、R3 修正のテスト不足（error state 永続化の assert なし）
- 後続推奨: types.ts ↔ state.ts 依存方向整理、runner モジュール Port パターン統一

### TICKET-006 — APPROVED
- R2 Required Changes（エージェント状態表示追加、barrel file import 統一）を確認
- 残存 medium: hardcoded "active" 表示、pane-to-stage インデックスマッピングの脆弱性、テスト不足
- 後続推奨: printAgentStatus テスト追加、cleanup ハンドラの try/catch 保護

## Phase History

| Phase | Started | Completed | Notes |
|-------|---------|-----------|-------|
| Plan | 2026-02-25 | 2026-02-25 | 8チケット作成完了 |
| Implement | 2026-02-25 | 2026-02-25 | TICKET-001〜007 実装完了 |
| Review R1 | 2026-02-25 | 2026-02-25 | 3 APPROVED, 3 BLOCKED, 1 CHANGES_REQUESTED |
| Implement R2 | 2026-02-25 | 2026-02-25 | TICKET-003〜006 修正完了、全チケット dev_done |
| Review R2 | 2026-02-25 | 2026-02-25 | 1 APPROVED (005), 3 CHANGES_REQUESTED (003,004,006) |
| Implement R3 | 2026-02-25 | 2026-02-25 | TICKET-003,004,006 修正完了、全チケット dev_done |
| Review R3 | 2026-02-25 | 2026-02-25 | 3 APPROVED (003,004,006)。全実装チケット closed |
