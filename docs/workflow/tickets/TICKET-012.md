---
id: TICKET-012
title: "auto_approve モード: 全エージェントを承認なしで実行"
status: changes_requested
assignee: "implementer-1"
priority: high
depends_on: [TICKET-010]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: M
---

# TICKET-012: auto_approve モード: 全エージェントを承認なしで実行

## Description

`config.yaml` の `agent.auto_approve: true` 設定により、
全エージェントを承認プロンプトなしで実行（danger mode）できるようにする。

- Claude Code: `--dangerously-skip-permissions` フラグ追加
- Codex: `--full-auto` フラグ追加

`spawn()` 時と `resetContext()` 時の両方でフラグを適用する。

## Acceptance Criteria

- [x] `config.yaml` の `agent.auto_approve` が `z.boolean().default(false)` でスキーマ定義済み
- [x] `StartCommandOptions` インターフェースに `autoApprove?: boolean` を定義
- [x] `CliAdapter.startCommand()` が `options?: StartCommandOptions` を受け取る
- [x] `ClaudeCodeAdapter.startCommand()` が `autoApprove: true` 時に `--dangerously-skip-permissions` を付与
- [x] `CodexAdapter.startCommand()` が `autoApprove: true` 時に `--full-auto` を付与
- [x] `AgentRunner.spawn()` が `StartCommandOptions` を受け取り adapter に渡す
- [x] `AgentRunner.resetContext()` が保存済みオプションを使って再起動する
- [x] `start.ts` が `config.agent.auto_approve` を読み取り spawn に渡す
- [x] テストで auto-approve フラグがコマンドに含まれることを検証（3テスト追加）
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス（109 tests, 0 fail）

## Implementation Notes

### Relevant Files

- `src/cli/config.ts` -- config スキーマ（`agent.auto_approve`）
- `src/runner/adapters/types.ts` -- `StartCommandOptions` / `CliAdapter` インターフェース
- `src/runner/adapters/ClaudeCodeAdapter.ts` -- Claude Code アダプター
- `src/runner/adapters/CodexAdapter.ts` -- Codex アダプター
- `src/runner/AgentRunner.ts` -- `AgentRunnerPort` / `AgentRunner`（spawn, resetContext）
- `src/cli/commands/start.ts` -- start コマンド（spawn 呼び出し元）
- `tests/runner/AgentRunner.test.ts` -- テスト

### Technical Constraints

- `AgentInfo` に `options?: StartCommandOptions` を保存し、`resetContext` でも同じフラグで再起動
- `spawn()` のシグネチャは後方互換（`options` は optional）
- Biome lint: import の alphabetical ordering に注意（`detectAgentStatus` が `type StartCommandOptions` より前）

### フラグ対応表

| CLI Tool | auto_approve: false | auto_approve: true |
|----------|--------------------|--------------------|
| Claude Code | `claude --model X` | `claude --model X --dangerously-skip-permissions` |
| Codex | `codex --model X` | `codex --model X --full-auto` |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/cli/config.ts | modify | `agent.auto_approve: z.boolean().default(false)` 追加 |
| src/runner/adapters/types.ts | modify | `StartCommandOptions` インターフェース追加、`CliAdapter.startCommand` シグネチャ変更 |
| src/runner/adapters/ClaudeCodeAdapter.ts | modify | `--dangerously-skip-permissions` フラグ対応 |
| src/runner/adapters/CodexAdapter.ts | modify | `--full-auto` フラグ対応 |
| src/runner/AgentRunner.ts | modify | `spawn()` に `options` 引数追加、`AgentInfo` に保存、`resetContext` で利用 |
| src/cli/commands/start.ts | modify | `config.agent.auto_approve` 読み取り → spawn に渡す |
| tests/runner/AgentRunner.test.ts | modify | auto-approve テスト 3 件追加 |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T16:41:00+09:00)

**Verdict**: CHANGES_REQUESTED

**Test Results**: 109 pass, 0 fail, bun tsc 0 errors, biome 0 errors

#### Code Quality
- [high] `auto_approve: true` 有効時にユーザーへの警告がない (start.ts:276-278)。`--dangerously-skip-permissions` はエージェントに全権限を付与するフラグであり、config.yaml に書くだけでサイレントに有効化される。`console.warn` で明示的な警告を出力すべき
- [medium] `resetContext` で auto_approve フラグが維持されることのテストがない。AC に「`resetContext()` が保存済みオプションを使って再起動する」とあるがテスト未検証。spawn 時のテスト 3 件は追加されている
- [low] `.crew/prompts/` が `.gitignore` に未設定 (init.ts:37-42)。プロンプトファイルにゴール文字列やテンプレート内容が含まれるため、機密情報の漏洩リスク

#### Security
- [high] auto_approve 有効時の不十分な警告 (CWE-250)。上記 Code Quality と同一。誤設定や意図しない有効化でエージェントが無制限のコマンド実行権限を持つリスク
- コマンドインジェクション防御は適切。`shellEscape` が `model` と `cwd` に適用され、auto_approve フラグはハードコード文字列のみ。問題なし
- `ModelId` は `z.enum()` で制約され、config.ts で `ModelIdSchema` としてバリデーション済み。問題なし

#### Architecture
- auto_approve の config → spawn → adapter 伝播パスは適切。CLI 層が設定を読み Runner 層に渡す自然なフロー
- `AgentInfo.options` に保存し `resetContext()` で再利用する設計は正しい (AgentRunner.ts:145,231-235)
- [medium] `CliAdapter` インターフェースのメンバー定義スタイルが不統一。`startCommand` は readonly 関数プロパティ、`clearCommand` は readonly string、`detectStatus` は通常メソッド。統一推奨
- [low] `spawnOptions` が `auto_approve: false` のとき `undefined` を渡す (start.ts:276-278)。`{ autoApprove: false }` の方が明示的

#### Required Changes
1. [start.ts:276 付近] `auto_approve: true` 有効時にコンソール警告を出力する
2. [tests/runner/AgentRunner.test.ts] `resetContext` で auto_approve フラグが維持されるテストを追加

#### 後続推奨
1. `.crew/prompts/` を `.gitignore` のエントリに追加
2. `CliAdapter` のメンバー定義スタイルを統一（全てメソッド記法に）
