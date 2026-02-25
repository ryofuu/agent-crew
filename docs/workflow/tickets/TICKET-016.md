---
id: TICKET-016
title: "エージェント idle 検知 & 自動ナッジ"
status: closed
assignee: "implementer-1"
priority: high
depends_on: []
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [feature]
estimated_complexity: M
---

# TICKET-016: エージェント idle 検知 & 自動ナッジ

## Description

ポーリングループはシグナルファイル検知のみ行い、エージェントの状態は見ていない。
エージェントが何らかの理由で idle（入力待ち）のまま止まった場合、手動介入なしでは復旧不可。

既存の `sendNudge`、`nudge_interval_seconds`(300s)、`max_escalation_phase`(3) を活用し、
ポーリングループ内でエージェントの idle 状態を検知して自動的にナッジメッセージを送信する。

## Acceptance Criteria

- [x] `PollContext` に `nudgeIntervalMs`、`maxNudges`、`lastActiveAt`、`nudgeCount` フィールドを追加
- [x] `maybeNudgeAgent()` 関数がポーリングループの各サイクルで呼び出される
- [x] エージェントが `active` なら `lastActiveAt` をリセットし `nudgeCount` を 0 に戻す
- [x] エージェントが `idle` で閾値超過かつ `nudgeCount < maxNudges` なら自動ナッジ送信
- [x] ログ出力: `Nudging '{role}' (attempt {n}/{max})...`
- [x] `nudge_interval_seconds` と `max_escalation_phase` を config から読み取り
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス

## Implementation

### Changes

1. **`PollContext` 拡張**: `nudgeIntervalMs`、`maxNudges`、`lastActiveAt`、`nudgeCount` フィールド追加
2. **`maybeNudgeAgent()` 関数追加**: エージェントの idle 状態を検知して自動ナッジ送信
3. **`pollLoop` にナッジロジック組み込み**: `tryAdvanceStage()` の後に `maybeNudgeAgent()` を呼出
4. **ナッジメッセージ**: 「タスクを続行してください。止まっている場合はシグナルファイルを作成してください。」

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/cli/commands/start.ts | modify | PollContext 拡張、maybeNudgeAgent 追加、pollLoop 統合 |

## Additional Changes (同時実施)

### .crew/ ディレクトリ構造の整理

プロジェクト固有の `.crew/` から不要なファイル/ディレクトリを除去:

1. **`.crew/prompts` → `os.tmpdir()/agent-crew-prompts`**: プロンプトファイルは一時ファイルなのでtmpdirに移動
2. **`.crew/workflows` → init で作成しない**: ビルトインテンプレートとグローバル `~/.crew/workflows` で十分
3. **`.crew/config.yaml` → `~/.crew/config.yaml`**: グローバル設定に変更、`project_name` は `path.basename(cwd)` から動的取得

| File | Action | Description |
|------|--------|-------------|
| src/runner/AgentRunner.ts | modify | sendInitialPrompt のプロンプトファイルを tmpdir に移動 |
| src/cli/config.ts | modify | readConfig/writeConfig を crewHome() ベースに変更、project_name 削除 |
| src/cli/commands/init.ts | modify | workflows ディレクトリ作成を削除、config を crewHome に書き込み |
| src/cli/commands/start.ts | modify | readConfig() 引数なし、projectName を cwd から取得 |
| src/cli/commands/stop.ts | modify | config 不要に、projectName を cwd から取得 |
| src/cli/commands/status.ts | modify | config 不要に、projectName を cwd から取得 |
| tests/cli/config.test.ts | modify | project_name 削除に追従 |
| tests/cli/commands.test.ts | modify | 同上 |
| tests/integration/crew-init.test.ts | modify | 同上 |
| tests/runner/AgentRunner.test.ts | modify | プロンプトファイルパスの検証を tmpdir に変更 |

## References

- config: `nudge_interval_seconds` (default: 300), `max_escalation_phase` (default: 3)
- AgentRunner: `sendNudge()`, `getStatus()`
