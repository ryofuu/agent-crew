---
id: TICKET-008
title: "統合テスト: crew init → crew start dev-cycle の E2E 動作確認"
status: closed
assignee: "implementer-1"
priority: medium
depends_on: [TICKET-006, TICKET-007]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [test]
estimated_complexity: M
---

# TICKET-008: 統合テスト: crew init → crew start dev-cycle の E2E 動作確認

## Description

Phase 1 MVP の統合テストを実装する。
実際の tmux セッションは起動せず、tmux・Claude Code・Codex をモック化した形で、
`crew init` → `crew start dev-cycle` → ワークフロー状態機械の動作を検証する。

## Acceptance Criteria

- [x] `crew init` 後に `.crew/` ディレクトリ構造が正しく生成されている
- [x] `crew start dev-cycle "test goal"` でワークフロー状態が `running` になる
- [x] タスクファイル作成 → ステータス遷移 → ループ評価の一連フローがテスト通過
- [x] `crew status` が正しい状態を出力する（TaskStore.list + WorkflowEngine.getState で検証）
- [x] `crew stop` でワークフロー状態が `completed` になりセッションが破棄される
- [x] `bun test tests/integration/` が全テスト通過（17 pass, 0 fail）

## Implementation Notes

### Relevant Files

- `tests/integration/crew-init.test.ts` — init コマンドテスト
- `tests/integration/workflow-cycle.test.ts` — start → status → stop サイクルテスト
- `tests/helpers/mocks.ts` — tmux / AgentRunner モック
- `tests/helpers/fixtures.ts` — テスト用ワークフロー定義 YAML

### Technical Constraints

- `bun:test` の `mock()` / `spyOn()` を使用
- tmux コマンドはモックで置き換え（実際の tmux プロセスを起動しない）
- テスト用一時ディレクトリ: `Bun.tmpdir()` + テスト後にクリーンアップ
- AgentRunner.spawn() はモック（実際のエージェントを起動しない）

### テストシナリオ

#### シナリオ 1: init フロー

```
1. 一時ディレクトリ作成
2. crew init 実行
3. .crew/ 以下のファイル存在確認
4. .gitignore 更新確認
```

#### シナリオ 2: ワークフローサイクル

```
1. crew init
2. crew start dev-cycle "test goal"
3. state.json が running を確認
4. タスクファイル TASK-001.md 作成
5. status: in_progress → dev_done → in_review → closed と更新
6. ワークフローが次ステージへ遷移することを確認
7. crew stop
8. state.json が idle/stopped を確認
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| tests/helpers/mocks.ts | add | MockTmux (TmuxPort実装) |
| tests/helpers/fixtures.ts | add | dev-cycle/simple-flow YAML fixtures + setup helper |
| tests/integration/crew-init.test.ts | add | init コマンド統合テスト (7 tests) |
| tests/integration/workflow-cycle.test.ts | add | ワークフローサイクル統合テスト (10 tests) |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T19:30:00+09:00)

**Verdict**: APPROVED

**Test Results**: 17 pass, 0 fail, 109 expect() calls (integration), 99 pass total

#### Code Quality
- [medium] `store.update()` 戻り値が "combined" テスト (L293-296) と "changes_requested" テスト (L335-338) で未検証。中間遷移が失敗してもテストが気づかない
- [medium] `--force` テスト (crew-init.test.ts:98-111) でマーカーファイルの削除/残存が未検証。テスト名 "overwrites" と実際の動作が不一致
- [medium] `createMockTmux` が固定値のみ返す最小スタブ。overrides パラメータで設定可能にすると拡張性向上
- [medium] テスト出力に `initCommand` の console.log が大量出力（ノイズ）
- [low] 変数名 `ip`, `dd`, `ir`, `cl` が短すぎる（可読性）
- 既存コード課題: `initCommand` が `process.exit(1)` を使用（Result 型規約違反）、`process.chdir()` のグローバル状態変更リスク

#### Security
- なし（テストコードとして健全。シークレットなし、外部アクセスなし、安全な tmpdir 使用）

#### Architecture
- [medium] MockTmux が `tests/helpers/mocks.ts` と `tests/runner/AgentRunner.test.ts` に重複定義（DRY 違反）
- [medium] AgentRunner テストが他モジュール（WorkflowEngine/TaskStore）との連携を検証していない（オーケストレーション層未実装のため暫定許容）
- [medium] `tests/helpers/` と `tests/integration/` は `src/` に対応しない独自ディレクトリ（統合テスト・ヘルパーの性質上許容。規約に例外追記推奨）
- [low] `readState` 直接インポートが `engine.getState()` API をバイパス

#### Required Changes
なし（Critical/High の問題なし。Medium は後続改善として推奨）

#### 後続推奨
1. `initCommand` を `Result<void, string>` 返却に変更し `process.exit` を CLI エントリポイントに限定
2. `createMockTmux(overrides?)` に拡張し、`AgentRunner.test.ts` のローカルモックを統合
3. "combined" / "changes_requested" テストの `store.update()` 戻り値を検証する `expectOk()` ヘルパー導入
4. CLAUDE.md の tests/ 規約に `helpers/` `integration/` の例外を追記
