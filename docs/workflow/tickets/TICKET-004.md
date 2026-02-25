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

### Round 1 (2026-02-25T12:00:00+09:00)

**Verdict**: BLOCKED

#### Code Quality
- [critical] `src/workflow/WorkflowEngine.ts` — TypeScript strict エラー 15 件。`noUncheckedIndexedAccess: true` により `state.stages[index]` アクセスが `T | undefined` を返すが、null チェックなし。全箇所でガード節を追加し `err()` を返すこと
  - L64, L66-67, L83, L88, L94, L96-97, L160, L168, L171, L181, L206, L208-209
- [critical] `tests/workflow/WorkflowEngine.test.ts` — TypeScript エラー 8 件。テスト内の `state.value.stages[N]` アクセスでも同様
  - L77-78, L100, L114-115, L147, L197
- [medium] `src/workflow/WorkflowEngine.ts:4` — `WorkflowStatus` が未使用 import（Biome lint エラー）
- [medium] `src/workflow/WorkflowEngine.ts:148` — `getState` が async だが await を使用していない

#### Security
- [high] `src/workflow/WorkflowEngine.ts:233-249` — `loadDefinition(workflowName)` でワークフロー名のバリデーションなし。`../../malicious` のようなパストラバーサルが可能。`/^[a-zA-Z0-9_-]+$/` で制限すること
- [medium] `src/workflow/WorkflowEngine.ts:238` & `src/cli/config.ts:41` — `yaml.load()` が明示的なスキーマ指定なし。js-yaml v4 のデフォルトは安全だが、明示的に `{ schema: yaml.JSON_SCHEMA }` を指定すべき
- [high] `src/workflow/state.ts:28` — `JSON.parse(raw) as WorkflowState` の unsafe cast。Zod バリデーションに置換すべき
- [medium] `src/cli/config.ts:52-61` — `writeConfig` が atomic write を使用していない。tmp→rename パターンに修正

#### Architecture
- [medium] ワークフロー状態遷移が手続き的コードに散在。TaskStore の `VALID_TRANSITIONS` のような宣言的マトリクスに統一すべき
- [medium] `src/workflow/schema.ts:9` — `on_complete` フィールドがパースされるが WorkflowEngine では一切使用されない。実装するか削除すべき

#### Required Changes
1. [src/workflow/WorkflowEngine.ts] 全15箇所の `state.stages[index]` アクセスにガード節を追加し TypeScript エラーを解消
2. [tests/workflow/WorkflowEngine.test.ts] 全8箇所の配列アクセスに null チェックまたは `!` アサーションを追加
3. [src/workflow/WorkflowEngine.ts:233] `loadDefinition` にワークフロー名バリデーション追加
4. [src/workflow/state.ts:28] `JSON.parse` の結果を Zod でバリデーション
5. [src/cli/config.ts:55] `writeConfig` を atomic write に修正

## Re-implementation Notes (Round 2)

1. TS strict エラー — 既にガード節が適用済み（前回の実装で対応済み）、テストも `?.` で安全にアクセス
2. `loadDefinition` — `/^[a-zA-Z0-9_-]+$/` でワークフロー名バリデーション追加
3. `state.ts` — `WorkflowStateSchema` を Zod で定義、`readState` で `safeParse` に置換
4. `writeConfig` — atomic write（tmp→rename）パターンに修正
5. `yaml.load` — `{ schema: yaml.JSON_SCHEMA }` を明示的に指定（WorkflowEngine, config.ts 両方）
