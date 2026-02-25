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

### Round 1 (2026-02-25T12:00:00+09:00)

**Verdict**: BLOCKED

#### Code Quality
- [medium] `src/runner/adapters/ClaudeCodeAdapter.ts:16-23` & `CodexAdapter.ts:11-18` — `detectStatus` が完全に同一のコード。共通ユーティリティに抽出すべき（DRY 違反）
- [medium] `src/runner/adapters/ClaudeCodeAdapter.ts:16-23` — ステータス検知が脆弱。`"error"` 文字列の検出が `"No errors found"` でも発火。`"$"` の検出が変数展開出力でも発火
- [medium] `src/runner/AgentRunner.ts:126` — `sendNudge` が async だが await を使用していない（Biome lint エラー）
- [low] `src/runner/tmux.ts:70`, `AgentRunner.ts:138` — `Bun.sleep(300)`, `Bun.sleep(500)` がマジックナンバー。名前付き定数にすべき

#### Security
- [critical] `src/runner/adapters/ClaudeCodeAdapter.ts:13` & `CodexAdapter.ts:8` — `startCommand` がシェルコマンドを文字列連結で構築。`cwd` と `model` パラメータの shell escape なし。ディレクトリ名に `;`, `$()`, バックティック等が含まれるとコマンドインジェクション可能
- [high] `src/runner/AgentRunner.ts:124-128` — `sendNudge` が制御文字を含む任意文字列を tmux ペインに送信可能。エージェントプロセスが終了してシェルプロンプトが表示されている場合、メッセージ内容がシェルコマンドとして実行される
- [high] `src/runner/AgentRunner.ts:174-184` — `writeInbox` でパストラバーサル。`agentName` にバリデーションなし
- [medium] `src/runner/AgentRunner.ts:174-184` — `writeInbox` が `appendFile` を使用（atomic write ではない）

#### Architecture
- [high] `src/runner/adapters/ClaudeCodeAdapter.ts:3-7` — `CliAdapter` インターフェースが実装ファイルに定義されている。`CodexAdapter` が `ClaudeCodeAdapter.ts` から import する不自然な結合。`src/runner/adapters/types.ts` に分離すべき
- [high] `src/runner/AgentRunner.ts:42-43` — `agents` Map と `sessionName` がインメモリのみ。プロセス再起動で情報が失われ、`crew stop` / `crew status` が機能しない。`state.json` に永続化が必要
- [medium] `src/runner/AgentRunner.ts:97-98` — アダプター選択がハードコード。レジストリ/ファクトリパターンで拡張性を確保すべき

#### Required Changes
1. [src/runner/adapters/ClaudeCodeAdapter.ts:13] & [CodexAdapter.ts:8] `startCommand` の `cwd` と `model` を shell-quote（`'${val.replace(/'/g, "'\\''")}'`）
2. [src/runner/AgentRunner.ts:124-128] `sendNudge` 前にエージェントの active 状態を確認。制御文字をサニタイズ
3. [src/runner/AgentRunner.ts:174-184] `agentName` を `/^[a-zA-Z0-9_-]+$/` でバリデーション
4. [src/runner/adapters/ClaudeCodeAdapter.ts:3-7] `CliAdapter` を `src/runner/adapters/types.ts` に移動

## Re-implementation Notes (Round 2)

1. `CliAdapter` インターフェースを `src/runner/adapters/types.ts` に分離
2. `shellEscape` ユーティリティ関数を types.ts に追加、`startCommand` で `cwd` と `model` をエスケープ
3. `detectAgentStatus` を共通ユーティリティとして抽出（DRY 解消）。ステータス検知ロジックを改善：`/$%#>/` を行末一致に変更し false positive を削減
4. `sendNudge` に `sanitizeMessage` を追加 — 制御文字（\x00-\x08, \x0b, \x0c, \x0e-\x1f, \x7f）を除去
5. `validateAgentName` を追加（`/^[a-zA-Z0-9_-]+$/`）— `spawn`, `writeInbox` で適用
6. `writeInbox` を atomic write（read → tmp write → rename）に修正
7. マジックナンバーを名前付き定数に変更（`CONTEXT_RESET_DELAY_MS`）
8. `getSessionName()`, `setSessionName()` を追加（crew stop でのセッション名復元用）
