---
id: TICKET-008
title: "統合テスト: crew init → crew start dev-cycle の E2E 動作確認"
status: todo
assignee: ""
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

- [ ] `crew init` 後に `.crew/` ディレクトリ構造が正しく生成されている
- [ ] `crew start dev-cycle "test goal"` でワークフロー状態が `running` になる
- [ ] タスクファイル作成 → ステータス遷移 → ループ評価の一連フローがテスト通過
- [ ] `crew status` が正しい状態を出力する
- [ ] `crew stop` でワークフロー状態が `idle` になりセッションが破棄される
- [ ] `bun test tests/integration/` が全テスト通過

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
| | | |

## Blocker

## Review Feedback
