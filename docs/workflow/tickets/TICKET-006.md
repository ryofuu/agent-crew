---
id: TICKET-006
title: "CLI Module: crew コマンド実装（init/start/status/stop/list/doctor）"
status: dev_done
assignee: "implementer-1"
priority: high
depends_on: [TICKET-003, TICKET-004, TICKET-005]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: L
---

# TICKET-006: CLI Module: crew コマンド実装（init/start/status/stop/list/doctor）

## Description

`commander` を使って crew CLI の全サブコマンドを実装する。
ワークフロー状態機械のメインループ（ポーリングベース）も含む。

## Acceptance Criteria

- [x] `crew init` が `.crew/` ディレクトリ構造を作成し `.gitignore` を更新する
- [x] `crew start <workflow> "<goal>"` が tmux セッションを起動し 3 エージェントをスポーンする
- [x] `crew status` がワークフロー状態・タスク一覧・エージェント状態を表示する
- [x] `crew stop [--force]` が全エージェントを停止し tmux セッションを破棄する
- [x] `crew list` がワークフロー定義一覧（3 層検索）を表示する
- [x] `crew doctor` が Bun/tmux/Claude Code/Codex のバージョンチェックを行い結果を表示する
- [x] メインループが 5 秒ポーリングで状態確認し `human_gate: true` 時に確認プロンプトを表示する
- [x] `bun test tests/cli/` が全テスト通過（5 tests, 0 fail）

## Implementation Notes

### Relevant Files

- `src/cli/index.ts` — commander セットアップ（エントリポイント）
- `src/cli/commands/init.ts` — `crew init`
- `src/cli/commands/start.ts` — `crew start` + メインループ
- `src/cli/commands/status.ts` — `crew status`
- `src/cli/commands/stop.ts` — `crew stop`
- `src/cli/commands/list.ts` — `crew list`
- `src/cli/commands/doctor.ts` — `crew doctor`
- `src/cli/config.ts` — `.crew/config.yaml` 読み書き
- `src/index.ts` — CLIエントリポイント

### Technical Constraints

- `commander` ライブラリを使用
- ワークフロー定義解決: `.crew/workflows/` → `CREW_HOME/workflows/` → `src/../templates/`
- `.crew/config.yaml` の `project_name` はカレントディレクトリ名をデフォルトにする
- メインループの間隔は 5 秒（設定可能）

### crew init の生成物

```
.crew/
├── config.yaml          # project_name, defaults
├── workflows/           # カスタムワークフロー置き場
├── tasks/               # タスクファイル置き場
│   └── _counter.txt     # "000"
├── inbox/               # Stop Hook 受信トレイ
├── state.json           # {} 初期値
└── logs/                # 実行ログ
```

`.gitignore` に `.crew/state.json`, `.crew/logs/` を追記。

### crew start メインループ（擬似コード）

```typescript
while (true) {
  const state = await engine.getState()
  if (state.status === 'completed') break
  if (state.status === 'error') { printError(); break }

  const stage = await engine.getCurrentStage()
  if (stage?.status === 'waiting_gate') {
    const confirmed = await promptUserConfirmation(stage)
    if (confirmed) await engine.approveGate()
    else await engine.rejectGate()
  }

  await Bun.sleep(5000)
}
```

### crew status 出力形式

```
Workflow: dev-cycle  Status: running  Cycle: 1/10
Stage: implement (active)

Tasks:
  TASK-001 [in_progress] Implement TaskStore  (implementer)
  TASK-002 [todo]        Implement CLI        (-)

Agents:
  planner     claude-code  idle
  implementer codex        active
  reviewer    claude-code  idle
```

### config.yaml スキーマ

```yaml
project_name: my-project
defaults:
  planner_model: claude-opus-4-6
  implementer_model: codex-1
  reviewer_model: claude-opus-4-6
tmux:
  session_prefix: crew
agent:
  nudge_interval_seconds: 300
  max_escalation_phase: 3
workflow:
  poll_interval_seconds: 5
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/config.ts` | created | Config Zod スキーマ + read/write/default |
| `src/cli/commands/init.ts` | created | crew init コマンド |
| `src/cli/commands/start.ts` | created | crew start + メインループ |
| `src/cli/commands/status.ts` | created | crew status コマンド |
| `src/cli/commands/stop.ts` | created | crew stop コマンド |
| `src/cli/commands/list.ts` | created | crew list コマンド |
| `src/cli/commands/doctor.ts` | created | crew doctor コマンド |
| `src/cli/index.ts` | created | commander セットアップ |
| `src/index.ts` | modified | CLI エントリポイントに変更 |
| `tests/cli/config.test.ts` | created | Config テスト（3 tests） |
| `tests/cli/cli.test.ts` | created | CLI コマンド登録テスト（2 tests） |

## Blocker

## Review Feedback
