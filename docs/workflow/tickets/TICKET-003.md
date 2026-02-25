---
id: TICKET-003
title: "Task Store Module: タスクファイル CRUD + ステータス遷移バリデーション"
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

# TICKET-003: Task Store Module: タスクファイル CRUD + ステータス遷移バリデーション

## Description

`.crew/tasks/` 配下のタスクファイル（Markdown + YAML frontmatter）の CRUD 操作とステータス遷移バリデーション、ファイル変更監視を実装する。

## Acceptance Criteria

- [x] `TaskStorePort` インターフェース全メソッドが実装されている（create, update, get, list, watch, stopWatch, nextId, getTaskFilePath）
- [x] タスクファイルは `.crew/tasks/TASK-{NNN}.md` 形式（0埋め3桁）で作成される
- [x] ステータス遷移の不正遷移は `INVALID_TRANSITION` エラーを返す
- [x] ファイル書き込みは atomic（tmp → rename）で行われる
- [x] `watch()` は 1 秒ポーリングで mtime 変化を検知しコールバックを呼ぶ
- [x] `bun test tests/store/` が全テスト通過（23 tests, 0 fail）
- [x] `bun run typecheck` エラーなし

## Implementation Notes

### Relevant Files

- `src/store/TaskStore.ts` — TaskStore 実装
- `src/store/types.ts` — Task, TaskFrontmatter 型
- `src/store/transitions.ts` — ステータス遷移マトリクス
- `src/store/index.ts` — re-export
- `src/kernel/types.ts` — TaskStatus 参照

### Technical Constraints

- `gray-matter` でフロントマター解析（`js-yaml` エンジン使用）
- ファイル監視は `fs.watch` / `setInterval` で実装（外部ライブラリなし）
- atomic write: `{path}.tmp` → `fs.rename()` パターン
- ID カウンタは `.crew/tasks/_counter.txt`（0埋め3桁）

### TaskStorePort インターフェース

```typescript
interface TaskStorePort {
  create(data: CreateTaskInput): Promise<Result<Task, string>>
  update(id: string, patch: UpdateTaskInput): Promise<Result<Task, string>>
  get(id: string): Promise<Result<Task, string>>
  list(filter?: TaskFilter): Promise<Result<Task[], string>>
  watch(callback: (task: Task) => void): () => void  // returns stopWatch fn
  stopWatch(): void
  nextId(): Promise<Result<string, string>>
  getTaskFilePath(id: string): string
}
```

### ステータス遷移マトリクス

```
todo           → in_progress
in_progress    → dev_done | blocked
dev_done       → in_review
in_review      → closed | changes_requested
changes_requested → in_progress
blocked        → in_progress
```

### Task ファイルフォーマット

```markdown
---
id: TASK-001
title: ""
status: todo
assignee: ""
priority: medium
depends_on: []
created_at: ""
updated_at: ""
stage: ""
labels: []
---

# TASK-001: {title}

## Description
...

## Acceptance Criteria
- [ ] 基準1

## Implementation Notes
...

## Files Changed
| File | Action | Description |
|------|--------|-------------|

## Review Feedback
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/store/types.ts` | created | Task, TaskFrontmatter, CreateTaskInput, UpdateTaskInput, TaskFilter, TaskStorePort |
| `src/store/transitions.ts` | created | ステータス遷移バリデーション |
| `src/store/TaskStore.ts` | created | TaskStorePort 全メソッド実装 |
| `src/store/index.ts` | created | re-export barrel |
| `tests/store/transitions.test.ts` | created | 遷移バリデーションテスト（10 tests） |
| `tests/store/TaskStore.test.ts` | created | TaskStore CRUD テスト（13 tests） |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T12:00:00+09:00)

**Verdict**: BLOCKED

#### Code Quality
- [medium] `TaskStore.nextId()` に競合状態あり。2つの並行呼び出しが同じカウンタ値を読み取り、重複IDを生成する可能性がある
- [medium] `watch()` / `stopWatch()` のテストが存在しない。コールバック発火のテストが必要
- [low] `list()` のエラー時に `TASK_NOT_FOUND` を返しているが、`READ_FAILED` が適切
- [medium] `src/store/TaskStore.ts:4` — `TaskStatus` が未使用 import（Biome lint エラー）

#### Security
- [critical] `src/store/TaskStore.ts:208` — `gray-matter` が JavaScript エンジン（`eval()`）を内蔵しており、タスクファイルの frontmatter に `---js` を指定するとコード実行が可能（CVE-2021-23398 関連）。`matter(raw, { language: "yaml" })` オプションで YAML エンジンに強制する必要あり
- [high] `src/store/TaskStore.ts:27-29` — `getTaskFilePath(id)` で ID のバリデーションなし。`../../etc/passwd` のようなパストラバーサルが可能。`/^TASK-\d{3,}$/` でバリデーションすること
- [high] `src/store/TaskStore.ts:209` — `data as TaskFrontmatter` の unsafe cast。`id` と `status` のみ検証で、他フィールドの型安全性なし。Zod スキーマでバリデーションすべき

#### Architecture
- なし。Port パターン、atomic write パターンは正しく適用されている。

#### Required Changes
1. [src/store/TaskStore.ts:208] `matter(raw)` → `matter(raw, { language: "yaml" })` で JS エンジンを無効化
2. [src/store/TaskStore.ts:27-29] `getTaskFilePath` に ID フォーマットバリデーション（`/^TASK-\d{3,}$/`）と `path.resolve` によるパストラバーサル防止を追加
3. [src/store/TaskStore.ts:209] `data as TaskFrontmatter` を Zod スキーマバリデーションに置換

## Re-implementation Notes (Round 2)

1. `matter(raw, { language: "yaml" })` — JS エンジン無効化完了
2. `getTaskFilePath` — `path.resolve` でパストラバーサル防止、`validateTaskId` で `/^TASK-\d{3,}$/` バリデーション追加（`get`, `update` の入口で検証）
3. `TaskFrontmatterSchema` を Zod で定義（`src/store/types.ts`）、`parseTaskFile` で `safeParse` に置換
4. `list()` のエラーコード: `TASK_NOT_FOUND` → `READ_FAILED` に修正
5. `TaskStoreErrors` に `READ_FAILED`, `INVALID_ID` を追加
6. watch テスト追加（mtime 変更検知のコールバック発火を検証）
7. ID バリデーションテスト追加（不正 ID でのget/update 拒否を検証）
