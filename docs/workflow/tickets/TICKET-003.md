---
id: TICKET-003
title: "Task Store Module: タスクファイル CRUD + ステータス遷移バリデーション"
status: closed
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

### Round 2 (2026-02-25T15:08:51+09:00)

**Verdict**: CHANGES_REQUESTED

#### Code Quality
- [high] `src/store/TaskStore.ts:30-38` — `getTaskFilePath()` がパストラバーサル検出時に `throw` を使用。プロジェクト規約「Result 型でエラーハンドリング（throw しない）」に違反。さらに `create()` (L105) が `getTaskFilePath()` 呼び出し前に `validateTaskId()` を呼んでいないため、不正IDがガード節なしで `getTaskFilePath` に到達可能
- [medium] `src/store/types.ts:4-36` — `TaskFrontmatterSchema` と `TaskFrontmatter` インターフェースが同一形状を二重定義。`z.infer<typeof TaskFrontmatterSchema>` で単一ソースに統一すべき
- [low] `src/store/TaskStore.ts:224` — watch ポーリング間隔 1000ms がマジックナンバー。名前付き定数に抽出すべき

#### Security
- なし。R1 の全 critical/high 問題（gray-matter eval injection, path traversal, unsafe cast）は正しく修正されている

#### Architecture
- [medium] `src/store/TaskStore.ts:49-66` — `nextId()` の read-increment-write が非アトミック。複数エージェント並行アクセス時に重複 ID 生成のリスクあり（TOCTOU）
- [medium] `src/store/types.ts:4-23` — `TaskFrontmatterSchema` の status/priority enum 値が `kernel/types.ts` と重複定義。kernel で const array を定義し参照すべき

#### Required Changes
1. [src/store/TaskStore.ts:105] `create()` 内で `getTaskFilePath()` 呼び出し前に `validateTaskId(id)` を追加
2. [src/store/TaskStore.ts:30-38] `getTaskFilePath()` の `throw` を `Result` パターンに変更するか、全呼び出し元で事前に `validateTaskId()` を保証する（最小修正: create() に validateTaskId 追加）

## Re-implementation Notes (Round 3)

1. `create()` に `validateTaskId(id)` を `getTaskFilePath(id)` 呼び出し前に追加。これにより `get()`, `update()`, `create()` の全呼び出し元で `getTaskFilePath` 到達前に ID バリデーションが保証される
2. `getTaskFilePath()` の `throw` は防御的最終ガードとして残留。全呼び出し元での事前バリデーションにより到達不能

### Round 3 (2026-02-25T17:00:00+09:00)

**Verdict**: APPROVED

#### Code Quality
- [medium] `getTaskFilePath()` (L30-37) が public メソッドかつ `TaskStorePort` インターフェースに定義されているため、外部から直接呼び出して `throw` に到達可能。全内部呼び出し元は `validateTaskId()` で保護済みのため実害なし。将来的に `Result<string, string>` への変更を推奨
- [medium] `create()` L87-88 の `validateTaskId(id)` は `nextId()` が常に有効な ID を生成するため到達不能な防御コード。契約保証としては正当だが、意図を示すコメントがあるとより良い
- [low] watch ポーリング間隔 1000ms (L227) がマジックナンバー。名前付き定数推奨（既知の pre-existing issue）
- [low] `create()` の validateTaskId ガードに対するテストがない（nextId() 経由では発火不能のため書きにくいが、防御意図のドキュメント化として有益）

#### Security
- なし。R1/R2 の全 critical/high 問題（gray-matter eval injection, path traversal, unsafe cast）修正済みを確認

#### Architecture
- [low] `TaskFrontmatterSchema` と `TaskFrontmatter` インターフェースの二重定義（R2 指摘）は未対応。`z.infer` 統一を後続チケットで推奨
- [low] `nextId()` TOCTOU（R2 指摘）は未対応。シングルプロセス前提では問題なし。マルチエージェント並行アクセス時に要対応

#### Required Changes
なし
