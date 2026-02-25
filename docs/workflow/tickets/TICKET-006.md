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

### Round 1 (2026-02-25T12:00:00+09:00)

**Verdict**: CHANGES_REQUESTED

#### Code Quality
- [high] CLI コマンドのテストが不足。`cli.test.ts` はコマンド名の登録確認のみ（2 tests）。`init`, `start`, `status`, `stop`, `list`, `doctor` の各コマンドロジックのテストがない
- [medium] `src/cli/commands/start.ts:8` — `startCommand` の認知的複雑度 20（Biome 上限 15 超過）。agent spawning と polling loop を分離すべき
- [medium] `src/cli/commands/start.ts:75-105` — `while (true)` ループに SIGINT/SIGTERM ハンドリングなし。プロセス kill 時に tmux セッション/エージェントが残存
- [low] `src/cli/commands/stop.ts:7` — `_options: { force?: boolean }` パラメータが未使用。`--force` フラグが効果なし
- [low] `src/cli/commands/init.ts:9` — `fs.existsSync` の同期呼び出し。他のコードは全て async API を使用

#### Security
- [high] `src/cli/commands/start.ts:47-59` — `config.defaults.planner_model as ModelId` の unsafe cast（3箇所）。Config の Zod スキーマで `z.string()` → `z.enum([...ModelId values])` に変更し、ランタイムバリデーションを行うこと
- [medium] `src/cli/commands/init.ts:21-28` — `_counter.txt`, `state.json`, `.gitignore` が atomic write でない
- [medium] `src/cli/commands/doctor.ts:5-8` — `minVersion` フィールドが定義されているが未使用。バージョン要件チェックが行われていない

#### Architecture
- [high] `src/cli/commands/stop.ts:23-25` — `new AgentRunner(tmux, crewDir, cwd)` で新規インスタンスを作成するが、`sessionName` が空のため `destroySession()` が即 `ok(undefined)` を返す。**crew stop が実質的に動作しない**。セッション名の永続化が必要
- [medium] `src/cli/commands/start.ts:42-69` — 3エージェントのレイアウトがハードコード。ワークフロー定義の `stages` から動的にエージェント構成を導出すべき
- [medium] `src/cli/commands/list.ts:6-13` — ワークフロー検索パスが `WorkflowEngine` と重複。共通ユーティリティに抽出すべき
- [medium] CLI コマンドが `process.exit()` でエラー処理。Result パターンに統一し、CLI エントリポイントで exit code を制御すべき

#### Required Changes
1. [src/cli/commands/start.ts:47-59] `as ModelId` を削除し、Config Zod スキーマで ModelId を `z.enum()` でバリデーション
2. [src/cli/commands/stop.ts] セッション名を `state.json` から復元し、`destroySession()` が実際に動作するよう修正
3. [tests/cli/] `init`, `start`, `stop`, `status`, `list`, `doctor` の各コマンドのテストを追加（少なくとも正常系・異常系各1ケース）
4. [src/cli/commands/start.ts] SIGINT/SIGTERM ハンドラを追加し、終了時に tmux セッションをクリーンアップ

## Re-implementation Notes (Round 2)

1. `config.ts` — `ModelIdSchema = z.enum(["claude-opus-4-6", "claude-sonnet-4-6", "codex-1", "codex-mini-latest"])` を導入、`z.string()` → `ModelIdSchema` に置換。`as ModelId` キャスト不要に
2. `start.ts` — `as ModelId` を全箇所削除。Config の型推論で ModelId が確定
3. `start.ts` — `AbortController` + `SIGINT/SIGTERM` ハンドラ追加。シグナル受信時に `destroySession()` + `engine.stop()` で cleanup
4. `start.ts` — `pollLoop` に `AbortSignal` を渡し、abort 時にループ終了
5. `stop.ts` — `runner.setSessionName(\`crew-${config.project_name}\`)` でセッション名を config から復元し `destroySession()` が動作するよう修正
6. `AgentRunner` に `getSessionName()`, `setSessionName()` を追加
7. `tests/cli/commands.test.ts` — init, config validation, stop, doctor, list のテスト追加（7 tests）
