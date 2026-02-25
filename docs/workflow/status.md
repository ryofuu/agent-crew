# Workflow Status Board

**Current Phase**: Implement (R2 修正完了、全チケット dev_done、レビュー待ち)
**Updated**: 2026-02-25T14:00:00+09:00
**Goal**: agent-crew Phase 1 MVP 実装（dev-cycle ワークフロー最小動作版）

## Ticket Summary

| Status | Count |
|--------|-------|
| todo | 1 |
| in_progress | 0 |
| blocked | 0 |
| dev_done | 4 |
| changes_requested | 0 |
| in_review | 0 |
| closed | 3 |

## Active Work

| Ticket | Title | Assignee | Status | Priority | Review |
|--------|-------|----------|--------|----------|--------|
| TICKET-001 | プロジェクト初期化 (package.json/tsconfig/biome) | implementer-1 | closed | critical | APPROVED (R1) |
| TICKET-002 | Shared Kernel: 型定義と Result<T,E> | implementer-1 | closed | critical | APPROVED (R1) |
| TICKET-003 | Task Store Module | implementer-1 | dev_done | high | R1 BLOCKED → R2 修正完了 |
| TICKET-004 | Workflow Engine Module | implementer-1 | dev_done | high | R1 BLOCKED → R2 修正完了 |
| TICKET-005 | Agent Runner Module | implementer-1 | dev_done | high | R1 BLOCKED → R2 修正完了 |
| TICKET-006 | CLI Module (crew コマンド全体) | implementer-1 | dev_done | high | R1 CHANGES_REQUESTED → R2 修正完了 |
| TICKET-007 | dev-cycle テンプレート + AGENTS.md | implementer-1 | closed | medium | APPROVED (R1) |
| TICKET-008 | 統合テスト (E2E) | - | todo | medium | - |

## Dependency Graph

```
TICKET-001 (プロジェクト初期化) ✅
  └─ TICKET-002 (Shared Kernel) ✅
       ├─ TICKET-003 (Task Store) 🟢 dev_done (R2)
       ├─ TICKET-004 (Workflow Engine) 🟢 dev_done (R2)
       └─ TICKET-005 (Agent Runner) 🟢 dev_done (R2)
            ├─ TICKET-006 (CLI) 🟢 dev_done (R2)
            └─ TICKET-007 (Templates/AGENTS) ✅
                 └─ TICKET-008 (統合テスト) ⏳ todo
```

## Quality Gate (R2)

- **TypeScript**: `bun tsc --noEmit` ✅ 0 errors
- **Biome lint**: `bun run lint` ✅ 0 errors
- **Tests**: `bun test` ✅ 82 pass, 0 fail

## R2 修正サマリ

### Security 修正
- gray-matter eval injection 防止 (`language: "yaml"` 強制)
- Path traversal 防止 (ID バリデーション + `path.resolve` チェック)
- Command injection 防止 (`shellEscape` で cwd/model をエスケープ)
- sendNudge 制御文字サニタイズ
- agentName バリデーション (`/^[a-zA-Z0-9_-]+$/`)
- unsafe cast 除去 → Zod バリデーション (TaskFrontmatter, WorkflowState, Config ModelId)
- yaml.load に `{ schema: yaml.JSON_SCHEMA }` 明示
- atomic write パターン統一 (writeConfig, writeInbox)

### Quality 修正
- CliAdapter インターフェース分離 (`types.ts`)
- detectStatus 共通化 (DRY 解消)
- crew stop 修正 (sessionName を config から復元)
- SIGINT/SIGTERM ハンドラ追加
- CLI コマンドテスト追加 (7 tests)
- watch テスト追加
- エラーコード修正 (list: TASK_NOT_FOUND → READ_FAILED)

## Phase History

| Phase | Started | Completed | Notes |
|-------|---------|-----------|-------|
| Plan | 2026-02-25 | 2026-02-25 | 8チケット作成完了 |
| Implement | 2026-02-25 | 2026-02-25 | TICKET-001〜007 実装完了 |
| Review R1 | 2026-02-25 | 2026-02-25 | 3 APPROVED, 3 BLOCKED, 1 CHANGES_REQUESTED |
| Implement R2 | 2026-02-25 | 2026-02-25 | TICKET-003〜006 修正完了、全チケット dev_done |
