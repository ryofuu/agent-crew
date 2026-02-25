---
id: TICKET-004
title: "Workflow Engine Module: ワークフロー定義パースと状態機械"
status: dev_done
assignee: "implementer-1"
priority: high
depends_on: [TICKET-002]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: M
---

# TICKET-004: Workflow Engine Module: ワークフロー定義パースと状態機械

## Description

YAML 形式のワークフロー定義をパースし、ステージ状態機械と state.json への永続化を実装する。
human_gate, loop_on_changes, max_cycles をサポートする。

## Acceptance Criteria

- [x] `WorkflowEnginePort` インターフェース全メソッドが実装されている（start, advance, pause, resume, stop, getState, getCurrentStage, canAdvance, approveGate, rejectGate）
- [x] Zod によるワークフロー定義 YAML バリデーションが通る
- [x] ステージ状態機械: `pending → active → completed`（`waiting_gate` を挟む場合あり）
- [x] `state.json` への atomic write が行われる
- [x] `evaluateLoopOrClose()` がループ条件を正しく評価する
- [x] `max_cycles` 超過時に `MAX_CYCLES_EXCEEDED` を返す
- [x] `bun test tests/workflow/` が全テスト通過（16 tests, 0 fail）

## Implementation Notes

### Relevant Files

- `src/workflow/WorkflowEngine.ts` — WorkflowEngine 実装
- `src/workflow/schema.ts` — Zod スキーマ（ワークフロー定義）
- `src/workflow/state.ts` — state.json の read/write
- `src/workflow/index.ts` — re-export
- `templates/dev-cycle.yaml` — dev-cycle ビルトインテンプレート

### Technical Constraints

- `js-yaml` でワークフロー YAML 読み込み、Zod でバリデーション
- `state.json` への書き込みは atomic（tmp + rename）
- ワークフロー定義解決: `.crew/workflows/` → `CREW_HOME/workflows/` → `templates/`（first match wins）

### WorkflowEnginePort インターフェース

```typescript
interface WorkflowEnginePort {
  start(workflowName: string, goal: string): Promise<Result<void, string>>
  advance(): Promise<Result<void, string>>
  pause(): Promise<Result<void, string>>
  resume(): Promise<Result<void, string>>
  stop(): Promise<Result<void, string>>
  getState(): Promise<Result<WorkflowState, string>>
  getCurrentStage(): Promise<Result<Stage | null, string>>
  canAdvance(): Promise<Result<boolean, string>>
  approveGate(): Promise<Result<void, string>>
  rejectGate(): Promise<Result<void, string>>
}
```

### ワークフロー定義 YAML スキーマ（Zod）

```typescript
const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  loop_on_changes: z.boolean().default(false),
  max_cycles: z.number().default(10),
  stages: z.array(z.object({
    name: z.string(),
    role: z.string(),
    model: z.string(),
    human_gate: z.boolean().default(false),
    context_reset: z.boolean().default(false),
    on_complete: z.array(z.string()).optional(),
  })),
})
```

### dev-cycle テンプレート（templates/dev-cycle.yaml）

```yaml
name: dev-cycle
description: "Plan → Implement → Review → loop"
loop_on_changes: true
max_cycles: 10
stages:
  - name: plan
    role: planner
    model: claude-opus-4-6
    human_gate: true
    context_reset: false
  - name: implement
    role: implementer
    model: codex-1
    human_gate: false
    context_reset: true
  - name: review
    role: reviewer
    model: claude-opus-4-6
    human_gate: true
    context_reset: true
    on_complete: [loop, close]
```

### state.json 構造

```typescript
type WorkflowState = {
  workflowName: string
  goal: string
  status: WorkflowStatus
  currentStageIndex: number
  cycleCount: number
  stages: StageState[]
  startedAt: string
  updatedAt: string
}
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/workflow/schema.ts` | created | Zod スキーマ（WorkflowDefinition, StageDefinition） |
| `src/workflow/state.ts` | created | state.json read/write（atomic） |
| `src/workflow/WorkflowEngine.ts` | created | WorkflowEnginePort 全メソッド実装 |
| `src/workflow/index.ts` | created | re-export barrel |
| `templates/dev-cycle.yaml` | created | dev-cycle ビルトインテンプレート |
| `tests/workflow/WorkflowEngine.test.ts` | created | WorkflowEngine テスト（16 tests） |

## Blocker

## Review Feedback
