---
id: TICKET-002
title: "Shared Kernel: 型定義と Result<T,E> ユーティリティ"
status: dev_done
assignee: "implementer-1"
priority: critical
depends_on: [TICKET-001]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: S
---

# TICKET-002: Shared Kernel: 型定義と Result<T,E> ユーティリティ

## Description

全モジュールが共通利用する型定義と Result 型ユーティリティを `src/kernel/` に実装する。
これが後続の全モジュール実装の基盤となる。

## Acceptance Criteria

- [x] `src/kernel/types.ts` に TaskStatus, WorkflowStatus, AgentStatus, ModelId, CliType が export されている
- [x] `src/kernel/result.ts` に `Result<T, E>`, `ok()`, `err()`, `isOk()`, `isErr()` が実装されている
- [x] `src/kernel/errors.ts` に各モジュールのエラーコード定数が定義されている
- [x] `bun test tests/kernel/` が全テスト通過（10 tests, 0 fail）
- [x] `bun run typecheck` エラーなし

## Implementation Notes

### Relevant Files

- `src/kernel/types.ts` — 型定義
- `src/kernel/result.ts` — Result 型
- `src/kernel/errors.ts` — エラーコード定数
- `src/kernel/index.ts` — re-export

### Technical Constraints

- Result 型は `neverthrow` ライブラリを使わず自前実装する（依存最小化）
- エラーコードは PRD `06-module-contracts.md` で定義済みのものを全て含める

### 型定義

```typescript
// types.ts
export type TaskStatus = 'todo' | 'in_progress' | 'dev_done' | 'in_review' | 'blocked' | 'changes_requested' | 'closed'
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'
export type AgentStatus = 'idle' | 'active' | 'error' | 'stopped'
export type ModelId = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'codex-1' | 'codex-mini-latest'
export type CliType = 'claude-code' | 'codex'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
```

### Result 型

```typescript
// result.ts
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok
export const isErr = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok
```

### エラーコード（PRD 06-module-contracts.md より）

```typescript
// errors.ts
export const WorkflowErrors = {
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  INVALID_DEFINITION: 'INVALID_DEFINITION',
  MAX_CYCLES_EXCEEDED: 'MAX_CYCLES_EXCEEDED',
  GATE_PENDING: 'GATE_PENDING',
  ALREADY_RUNNING: 'ALREADY_RUNNING',
  NOT_RUNNING: 'NOT_RUNNING',
} as const

export const AgentErrors = {
  SPAWN_FAILED: 'SPAWN_FAILED',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  TMUX_ERROR: 'TMUX_ERROR',
  NUDGE_FAILED: 'NUDGE_FAILED',
  SESSION_EXISTS: 'SESSION_EXISTS',
} as const

export const TaskStoreErrors = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  WRITE_FAILED: 'WRITE_FAILED',
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

export const CLIErrors = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  CONFIG_ERROR: 'CONFIG_ERROR',
} as const
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/kernel/types.ts` | created | TaskStatus, WorkflowStatus, AgentStatus, ModelId, CliType, Priority |
| `src/kernel/result.ts` | created | Result<T,E>, ok(), err(), isOk(), isErr() |
| `src/kernel/errors.ts` | created | WorkflowErrors, AgentErrors, TaskStoreErrors, CLIErrors |
| `src/kernel/index.ts` | created | re-export barrel |
| `tests/kernel/result.test.ts` | created | Result 型のユニットテスト（6 tests） |
| `tests/kernel/errors.test.ts` | created | エラー定数のユニットテスト（4 tests） |

## Blocker

## Review Feedback
