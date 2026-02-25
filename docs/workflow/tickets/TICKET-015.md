---
id: TICKET-015
title: "context_reset で /clear を送信するように変更（プロセス再起動をやめる）"
status: closed
assignee: "implementer-1"
priority: high
depends_on: [TICKET-014]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [bugfix, improvement]
estimated_complexity: S
---

# TICKET-015: context_reset で /clear を送信するように変更

## Description

`context_reset: true` のステージでコンテキストリセットが実行される際、
旧実装では Escape+Ctrl-C でプロセスを終了し、CLI を再起動していた。
この方法では `/clear` コマンドが送られず、起動コストも高い。

CLI の `/clear` コマンド（Codex は `/new`）を送信するだけでコンテキストリセットを
実現するように変更する。

## Root Cause

`AgentRunner.resetContext` が以下の手順で動作していた:

1. `sendKeys(pane, "\x1b\x03")` — Escape + Ctrl-C（CLI プロセスを中断）
2. 500ms 待機
3. `sendText(pane, "cd ... && claude ...")` — CLI を再起動

これではプロセス内の `/clear` コマンドが使われず、再起動のオーバーヘッドも発生。

## Acceptance Criteria

- [x] Claude Code の場合 `/clear` + Enter が tmux 経由で送信される
- [x] Codex の場合 `/new` + Enter が tmux 経由で送信される
- [x] プロセスの再起動が行われない
- [x] 不要になった `CONTEXT_RESET_DELAY_MS` 定数が削除されている
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス

## Implementation

### Changes

1. **`ClaudeCodeAdapter.clearCommand`**: `"\x1b\x03"` → `"/clear"`
2. **`CodexAdapter.clearCommand`**: `"\x1b"` → `"/new"`
3. **`AgentRunner.resetContext`**: プロセス再起動ロジックを削除し、`sendText(pane, clearCommand)` のみに簡素化
4. **`CONTEXT_RESET_DELAY_MS`**: 不要になったため削除

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/runner/AgentRunner.ts | modify | resetContext を簡素化、CONTEXT_RESET_DELAY_MS 削除 |
| src/runner/adapters/ClaudeCodeAdapter.ts | modify | clearCommand を `/clear` に変更 |
| src/runner/adapters/CodexAdapter.ts | modify | clearCommand を `/new` に変更 |

## References

- [Codex CLI /clear issue](https://github.com/openai/codex/issues/405)
- [Codex CLI /new command](https://developers.openai.com/codex/cli/slash-commands/)
