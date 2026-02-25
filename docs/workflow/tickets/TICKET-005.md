---
id: TICKET-005
title: "Agent Runner Module: tmux セッション管理 + エージェント起動/停止"
status: dev_done
assignee: "implementer-1"
priority: high
depends_on: [TICKET-002]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: L
---

# TICKET-005: Agent Runner Module: tmux セッション管理 + エージェント起動/停止

## Description

tmux セッション管理、エージェントの起動/停止、nudge 送信、コンテキストリセット、ステータス検知を実装する。
Claude Code と Codex の 2 CLI アダプターを含む。

## Acceptance Criteria

- [x] `AgentRunnerPort` インターフェース全メソッドが実装されている
- [x] tmux セッション `crew-{project_name}` が正しく作成・破棄される
- [x] 3ペインレイアウト（tiled）が設定される
- [x] nudge 送信は `text + 0.3s sleep + Enter` の順で送信される
- [x] `ClaudeCodeAdapter` と `CodexAdapter` が実装されている
- [x] コンテキストリセット（clearCommand + restart）が実装されている
- [x] inbox 書き込み（`.crew/inbox/{agent_name}.md`）が実装されている
- [x] `bun test tests/runner/` が全テスト通過（13 tests, 0 fail, tmux mock）

## Implementation Notes

### Relevant Files

- `src/runner/AgentRunner.ts` — AgentRunner 実装
- `src/runner/adapters/ClaudeCodeAdapter.ts` — Claude Code CLI アダプター
- `src/runner/adapters/CodexAdapter.ts` — Codex CLI アダプター
- `src/runner/tmux.ts` — tmux コマンドラッパー
- `src/runner/index.ts` — re-export

### Technical Constraints

- tmux コマンドは `Bun.spawn()` 経由で実行
- nudge 送信パターン: `tmux send-keys -t {pane} "{text}" "" && sleep 0.3 && tmux send-keys -t {pane} "" Enter`
- ステータス検知: grep fast-path → full parse fallback with multi-sample confirmation
- Claude Code リセット: Escape + C-c
- Codex リセット: Escape のみ

### AgentRunnerPort インターフェース

```typescript
interface AgentRunnerPort {
  spawn(agentName: string, role: string, cliType: CliType, model: ModelId): Promise<Result<void, string>>
  stop(agentName: string): Promise<Result<void, string>>
  stopAll(): Promise<Result<void, string>>
  sendNudge(agentName: string, message: string): Promise<Result<void, string>>
  resetContext(agentName: string): Promise<Result<void, string>>
  getStatus(agentName: string): Promise<Result<AgentStatus, string>>
  getAllStatuses(): Promise<Result<Record<string, AgentStatus>, string>>
  isActive(agentName: string): Promise<Result<boolean, string>>
  createSession(projectName: string): Promise<Result<void, string>>
  destroySession(): Promise<Result<void, string>>
  setupLayout(agentCount: number): Promise<Result<void, string>>
}
```

### CLI アダプター

```typescript
interface CliAdapter {
  readonly startCommand: (model: ModelId, cwd: string) => string
  readonly clearCommand: string  // コンテキストリセット時のキーシーケンス
  detectStatus(paneOutput: string): AgentStatus
}

// ClaudeCodeAdapter
startCommand: (model, cwd) => `claude --model ${model}`
clearCommand: '\x1b\x03'  // Escape + C-c

// CodexAdapter
startCommand: (model, cwd) => `codex --model ${model}`
clearCommand: '\x1b'  // Escape のみ
```

### tmux レイアウト（3エージェント）

```
┌─────────────────────┬─────────────────────┐
│    Planner (Opus)   │  Implementer (Codex) │
│   crew-planner      │   crew-implementer   │
├─────────────────────┴─────────────────────┤
│              Reviewer (Opus)               │
│             crew-reviewer                  │
└────────────────────────────────────────────┘
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/runner/tmux.ts` | created | TmuxPort インターフェース + Tmux 実装 |
| `src/runner/adapters/ClaudeCodeAdapter.ts` | created | CliAdapter + ClaudeCode 実装 |
| `src/runner/adapters/CodexAdapter.ts` | created | Codex CLI アダプター |
| `src/runner/AgentRunner.ts` | created | AgentRunnerPort 全メソッド実装 |
| `src/runner/index.ts` | created | re-export barrel |
| `tests/runner/AgentRunner.test.ts` | created | AgentRunner テスト（13 tests, mock tmux） |

## Blocker

## Review Feedback
