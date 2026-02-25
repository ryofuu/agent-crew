# Workflow Status Board

**Current Phase**: Review (011/012) R1 — Both CHANGES_REQUESTED
**Updated**: 2026-02-25T16:41:00+09:00
**Goal**: agent-crew Phase 1 MVP 実装（dev-cycle ワークフロー最小動作版）+ Phase 2 機能追加

## Ticket Summary

| Status | Count |
|--------|-------|
| todo | 0 |
| in_progress | 0 |
| blocked | 0 |
| dev_done | 0 |
| changes_requested | 3 |
| in_review | 0 |
| closed | 9 |

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
| TICKET-008 | 統合テスト (E2E) | implementer-1 | closed | medium | APPROVED (R1) |
| TICKET-009 | simple-flow.yaml テンプレート | implementer-1 | closed | medium | APPROVED (R1) |
| TICKET-010 | プロンプト送信+ステージ自動遷移 | implementer-1 | changes_requested | critical | R1: 4 Required Changes |
| TICKET-011 | シグナルファイルによるステージ完了検知 | implementer-1 | changes_requested | critical | R1: 2 Required Changes |
| TICKET-012 | auto_approve モード | implementer-1 | changes_requested | high | R1: 2 Required Changes |

## Dependency Graph

```
TICKET-001 (プロジェクト初期化) ✅
  └─ TICKET-002 (Shared Kernel) ✅
       ├─ TICKET-003 (Task Store) ✅ APPROVED (R3)
       ├─ TICKET-004 (Workflow Engine) ✅ APPROVED (R3)
       └─ TICKET-005 (Agent Runner) ✅ APPROVED (R2)
            ├─ TICKET-006 (CLI) ✅ APPROVED (R3)
            └─ TICKET-007 (Templates/AGENTS) ✅
                 └─ TICKET-008 (統合テスト) ✅ APPROVED (R1)
                      ├─ TICKET-009 (simple-flow) ✅ APPROVED (R1)
                      └─ TICKET-010 (プロンプト送信) ⚠️ CHANGES_REQUESTED (R1)
                           ├─ TICKET-011 (シグナルファイル) ⚠️ CHANGES_REQUESTED (R1)
                           └─ TICKET-012 (auto_approve) ⚠️ CHANGES_REQUESTED (R1)
```

## Quality Gate (TICKET-011/012 Review)

- **TypeScript**: `bun tsc --noEmit` ✅ 0 errors
- **Biome lint**: `bun run lint` ✅ 0 errors
- **Tests**: `bun test` ✅ 109 pass, 0 fail

## TICKET-011 R1 Review Summary

**Verdict**: CHANGES_REQUESTED — High 2 件

### Required Changes (必須修正 2 件)
1. **[high] TOCTOU レースコンディション**: `checkSignal` + `removeSignal` を `consumeSignal`（unlink ベースのアトミック操作）に統合
2. **[high] signalPath パストラバーサル**: ロール名バリデーション (`/^[a-zA-Z0-9_-]+$/`) を追加（多層防御）

### 後続推奨 (4 件)
- シグナルファイル操作を `src/workflow/signals.ts` に切り出し
- start.ts の非 export 関数のモジュール分割でテスト容易性改善
- `PollContext.promptedStageIndex` デッドコード削除
- `getState()` 呼び出し回数を 1 サイクル 1 回に削減

## TICKET-012 R1 Review Summary

**Verdict**: CHANGES_REQUESTED — High 1 件 + Medium 1 件

### Required Changes (必須修正 2 件)
1. **[high] auto_approve 警告欠如**: `auto_approve: true` 有効時にコンソール警告を出力
2. **[medium] resetContext テスト不足**: auto_approve フラグが `resetContext` で維持されるテストを追加

### 後続推奨 (2 件)
- `.crew/prompts/` を `.gitignore` に追加
- `CliAdapter` メンバー定義スタイルの統一

## TICKET-010 R1 Review Summary (既存)

**Verdict**: CHANGES_REQUESTED — Critical バグ 2 件 + High 問題 4 件

### Required Changes (必須修正 4 件)
1. **[critical] gate 承認後のプロンプト未送信**: `handleGate` にプロンプト送信機能追加
2. **[critical] ループ時の promptedStageIndex 未リセット**: PollContext に `currentCycle` 追加
3. **[high] sendInitialPrompt の try/catch 欠如**: fs 操作を try/catch で囲み `err()` を返す
4. **[high] role フィールドのパストラバーサル**: schema.ts の role に regex バリデーション追加

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
| Implement (008) | 2026-02-25 | 2026-02-25 | TICKET-008 統合テスト実装完了 |
| Review (008) | 2026-02-25 | 2026-02-25 | TICKET-008 APPROVED (R1)。全8チケット closed |
| Implement (009/010) | 2026-02-25 | 2026-02-25 | TICKET-009/010 実装完了 |
| Review (009/010) | 2026-02-25 | 2026-02-25 | 009 APPROVED, 010 CHANGES_REQUESTED (R1) |
| Implement (011/012) | 2026-02-25 | 2026-02-25 | TICKET-011/012 実装完了 |
| Review (011/012) | 2026-02-25 | 2026-02-25 | 011 CHANGES_REQUESTED, 012 CHANGES_REQUESTED (R1) |
