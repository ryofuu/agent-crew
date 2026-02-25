---
id: TICKET-010
title: "エージェントへのプロンプト送信とステージ自動遷移の実装"
status: in_review
assignee: "implementer-1"
priority: critical
depends_on: [TICKET-008]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: L
---

# TICKET-010: エージェントへのプロンプト送信とステージ自動遷移の実装

## Description

`crew start` でエージェント（Claude Code / Codex）を tmux に起動した後、
ゴールやロール指示が一切送信されておらず、エージェントが CLI プロンプトで待機するだけで動作しない致命的バグを修正する。

さらに `pollLoop` にステージ遷移ロジックがなく、planner が完了しても implementer に制御が移らない問題も合わせて修正する。

## Acceptance Criteria

- [x] `Tmux.sendPromptFile()` が `load-buffer` + `paste-buffer -p` で長文プロンプトを安全に送信できる
- [x] `AgentRunner.waitForReady()` が active→idle 遷移を検知して CLI 起動完了を待てる
- [x] `AgentRunner.sendInitialPrompt()` が `.crew/prompts/{agent}.md` にプロンプトを書き出し tmux 経由で送信する
- [x] `WorkflowEngine.getStageDefinitions()` でステージ→ロールのマッピングが取得できる
- [x] `start.ts` が spawn 後にアクティブステージのエージェントへロールテンプレート + ゴールを送信する
- [x] `pollLoop` がアクティブエージェントの idle 検知 → `engine.advance()` → 次エージェントへプロンプト送信を行う
- [x] `buildAgentList` がワークフロー定義ベースで動的にエージェントリストを構築する（ハードコード廃止）
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス（106 tests, 0 fail）

## Implementation Notes

### Relevant Files

- `src/runner/tmux.ts` -- tmux ラッパー（TmuxPort インターフェース）
- `src/runner/AgentRunner.ts` -- エージェントライフサイクル管理
- `src/workflow/WorkflowEngine.ts` -- ワークフロー状態管理
- `src/workflow/types.ts` -- WorkflowEnginePort インターフェース
- `src/cli/commands/start.ts` -- start コマンド（spawn + pollLoop）
- `templates/agents/*.md` -- ロール別テンプレート（planner/implementer/reviewer）

### Technical Constraints

- プロンプト送信は tmux `load-buffer` + `paste-buffer -p`（bracketed paste）で行い、shell escaping 問題を回避
- `waitForReady` は active→idle の2段階検知（shell prompt 誤検知を防止）
- `pollLoop` の認知的複雑度を Biome 上限 15 以内に収めるため `tryAdvanceStage` をヘルパーとして抽出
- `getStageDefinitions` は同期メソッド（await 不要のため Biome lint 準拠）

### アーキテクチャ: プロンプト送信フロー

```
spawn() → CLI 起動
  ↓
waitForReady() → active→idle 検知（最大15秒）
  ↓
sendInitialPrompt() → .crew/prompts/{agent}.md 書き出し
  ↓
tmux load-buffer → paste-buffer -p → Enter
  ↓
エージェント作業開始
```

### アーキテクチャ: ステージ遷移フロー

```
pollLoop
  ↓
tryAdvanceStage() → runner.getStatus() で idle 検知
  ↓
engine.advance() → 現ステージ completed、次ステージ active
  ↓
promptAgent() → 次エージェントへ waitForReady + sendInitialPrompt
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/runner/tmux.ts | modify | TmuxPort に `sendPromptFile` 追加、Tmux に実装 |
| src/runner/AgentRunner.ts | modify | AgentRunnerPort に `waitForReady` / `sendInitialPrompt` 追加、実装 |
| src/workflow/WorkflowEngine.ts | modify | `getStageDefinitions()` 追加、StageDefinition import 追加 |
| src/workflow/types.ts | modify | WorkflowEnginePort に `getStageDefinitions` 追加 |
| src/cli/commands/start.ts | modify | プロンプト送信・ステージ遷移ロジック全面実装、buildAgentList 動的化 |
| tests/runner/AgentRunner.test.ts | modify | MockTmux に `sendPromptFile` 追加、sendInitialPrompt/waitForReady テスト追加 |
| tests/workflow/WorkflowEngine.test.ts | modify | `getStageDefinitions` テスト追加 |
| tests/helpers/mocks.ts | modify | createMockTmux に `sendPromptFile` 追加 |
| tests/cli/commands.test.ts | modify | mockTmux に `sendPromptFile` 追加 |

## Blocker

## Review Feedback
