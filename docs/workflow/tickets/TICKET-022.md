---
id: TICKET-022
title: "エージェントプロセス管理 & 自動リカバリ"
status: closed
assignee: ""
priority: high
depends_on: []
created_by: orchestrator
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [backend]
estimated_complexity: L
---

# TICKET-022: エージェントプロセス管理 & 自動リカバリ

## Description

Claude Code / Codex CLI が tmux pane 内でハングすることがある。現状は手動で kill → 再起動が必要。各エージェントのプロセス情報（PID等）を追跡し、ハング検知時に自動で再起動・プロンプト再送信する仕組みを追加する。

### ユーザー操作フロー

**通常時（自動リカバリ）:** ユーザー操作不要。poll loop がプロセス死亡を検知して自動で再起動・プロンプト再送。

**手動リカバリ:**
```bash
crew status                  # PID と alive/dead を確認
crew restart implementer     # 指定エージェントを kill → 再起動 → プロンプト再送
```

## Acceptance Criteria

- [x] `ProcessHealth` 型（`alive | dead | unknown`）を `src/kernel/types.ts` に追加
- [x] `RESPAWN_FAILED` エラー定数を `src/kernel/errors.ts` に追加
- [x] `TmuxPort` に `getPanePid` メソッド追加（`tmux display-message -p "#{pane_pid}"`）
- [x] `ProcessProbe` (Port パターン) で OS プロセス検査を分離（`pgrep`, `process.kill(pid, 0)`）
- [x] `AgentRegistry` で `.crew/agents.json` の Zod バリデーション + atomic write
- [x] `AgentRunner` に `recordPid` / `checkHealth` / `respawn` / `persistRegistry` メソッド追加
- [x] ハング判定ロジック: shellPid 死亡 → dead, shellPid 生存 + agentPid 死亡 + 子プロセスなし → dead
- [x] `agent.max_respawns` (default: 3) を config に追加
- [x] `maybeRecoverAgent` を poll loop に統合（`tryAdvanceStage` → `maybeRecoverAgent` → `maybeNudgeAgent`）
- [x] spawn 後に PID 記録 + `agents.json` 永続化
- [x] `crew status` で `agents.json` から PID / alive|dead / respawn 回数を表示
- [x] `crew restart <agent>` コマンド新規追加
- [x] ProcessProbe / AgentRegistry / AgentRunner のユニットテスト追加
- [x] `bun run typecheck` 型エラーなし
- [x] `bun run lint` Biome 0 エラー
- [x] `bun test` 全テスト通過（145 pass, 0 fail）

## Implementation Notes

### 設計ポイント

- **ProcessProbe**: Port パターンで OS プロセス検査を分離。テストで mock 差し替え可能
- **AgentRegistry**: `.crew/agents.json` に Zod スキーマ定義 + atomic write で永続化
- **AgentRunner 拡張**: AgentInfo に `cliType`, `shellPid`, `agentPid`, `spawnedAt`, `respawnCount` を追加
- **Poll Loop 統合**: `maybeRecoverAgent` が dead 検知 → respawn → waitForReady → recordPid → promptAgent

### Relevant Files

- `src/runner/ProcessProbe.ts` -- OS プロセス検査 (Port パターン)
- `src/runner/AgentRegistry.ts` -- agents.json 管理 (Zod + atomic write)
- `src/runner/AgentRunner.ts` -- PID 追跡・ヘルスチェック・リスポーン
- `src/cli/commands/start.ts` -- poll loop への maybeRecoverAgent 統合
- `src/cli/commands/restart.ts` -- crew restart コマンド

### Technical Constraints

- `pgrep` は macOS / Linux の両方で動作する
- atomic write パターン（tmp → rename）を遵守
- respawn 上限（max_respawns）を超えたらログ出力して諦める

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/kernel/types.ts` | modified | `ProcessHealth` 型追加 |
| `src/kernel/errors.ts` | modified | `RESPAWN_FAILED` 定数追加 |
| `src/kernel/index.ts` | modified | `ProcessHealth` export |
| `src/runner/ProcessProbe.ts` | new | OS プロセス検査（pgrep, kill -0）|
| `src/runner/AgentRegistry.ts` | new | agents.json の Zod バリデーション + atomic write |
| `src/runner/AgentRunner.ts` | modified | AgentInfo 拡張、recordPid/checkHealth/respawn/persistRegistry 追加 |
| `src/runner/tmux.ts` | modified | TmuxPort に getPanePid 追加 |
| `src/runner/index.ts` | modified | 新モジュールの export |
| `src/cli/config.ts` | modified | agent.max_respawns (default: 3) |
| `src/cli/commands/start.ts` | modified | maybeRecoverAgent を poll loop に追加、spawn 後に PID 記録 |
| `src/cli/commands/status.ts` | modified | agents.json から PID/health 表示 |
| `src/cli/commands/restart.ts` | new | crew restart コマンド |
| `src/cli/index.ts` | modified | restart コマンド登録 |
| `tests/runner/ProcessProbe.test.ts` | new | ProcessProbe ユニットテスト |
| `tests/runner/AgentRegistry.test.ts` | new | AgentRegistry 読み書きテスト |
| `tests/runner/AgentRunner.test.ts` | modified | recordPid/checkHealth/respawn/persistRegistry テスト追加 |
| `tests/helpers/mocks.ts` | modified | MockTmux に getPanePid 追加 |
| `tests/cli/commands.test.ts` | modified | MockTmux に getPanePid 追加 |

## Review Feedback

N/A (手動実装)
