---
id: TICKET-010
title: "エージェントへのプロンプト送信とステージ自動遷移の実装"
status: changes_requested
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

### Round 1 (2026-02-25T21:00:00+09:00)

**Verdict**: CHANGES_REQUESTED

**Test Results**: 106 pass, 0 fail, bun tsc 0 errors, biome 0 errors

#### Code Quality
- [critical] `pollLoop`: gate 承認後にアクティブ化されたステージのエージェントにプロンプトが送信されない。`handleGate` は `runner` を受け取っておらず、承認後に `promptAgent` が呼ばれない。dev-cycle フローでは planner が永久に待機する
- [critical] `pollLoop`: `promptedStageIndex` がループサイクル時にリセットされない。`nextIdx > ctx.promptedStageIndex` (start.ts:141) の条件により、2周目以降のエージェントにプロンプトが送信されない (`nextIdx` は 0 に戻るが `promptedStageIndex` は前サイクルの値のまま)
- [high] `sendInitialPrompt` (AgentRunner.ts:179-193) に try/catch がなく、`fs.promises.mkdir` / `writeFile` / `rename` の例外が throw される。同クラスの `writeInbox` (L265) は try/catch + `err()` パターンで処理しており不整合。プロジェクト規約「throw しない」に違反
- [high] `loadRoleTemplate` (start.ts:33-42) の catch 節が全例外を飲み込む。ENOENT 以外のエラー（パーミッションエラー等）もサイレントにフォールバックしデバッグ困難
- [high] `promptAgent` (start.ts:84-98) が `waitForReady` の Result を無視。err が返されてもそのまま `sendInitialPrompt` を実行する
- [medium] `getState()` が 1 ポーリングサイクルで最大 3 回呼ばれる (pollLoop:175 + tryAdvanceStage:113,132)。ファイル I/O を伴うため非効率。tryAdvanceStage に state を引数で渡すべき
- [medium] `buildAgentList` (start.ts:26-28) の `stage.model.startsWith("codex")` による CLI タイプ判定が脆弱。モデル名変更時に破綻する。マッピングテーブルまたはスキーマに `cli_type` フィールド追加を推奨
- [medium] `model: stage.model as ModelId` (start.ts:29) の unsafe cast。`StageDefinitionSchema` の `model` が `z.string()` で制約なし。`z.enum()` でバリデーション追加を推奨
- [medium] `getStageDefinitions` (WorkflowEngine.ts:229-232) が `this.definition.stages` の参照を直接返す。呼び出し元での変更が内部状態を破壊する。`[...this.definition.stages]` でコピーすべき
- [medium] `start.ts` 内の `buildAgentList`, `loadRoleTemplate`, `buildPrompt`, `tryAdvanceStage` が非 export でユニットテスト不可能。特に `tryAdvanceStage` のロジックバグがテスト不在で検出されなかった
- [medium] `promptAgent` で `agentName` と `role` が常に同じ値で呼ばれている (start.ts:144-148, 262)。冗長なパラメータ
- [low] `waitForReady` のタイムアウト時にログ出力がなく ok を返す (AgentRunner.ts:175-176)。デバッグ困難
- [low] `Bun.sleep(1000)` がハードコード (AgentRunner.ts:173)。定数化推奨

#### Security
- [high] `loadRoleTemplate` でパストラバーサル脆弱性 (CWE-22)。`role` は `StageDefinitionSchema` で `z.string()` のみ。`role: "../../etc/passwd"` のような値でテンプレートディレクトリ外のファイルが読み取られ、プロンプトに埋め込まれる。`schema.ts` の `role` フィールドに `/^[a-zA-Z0-9_-]+$/` を追加すべき
- [medium] `.crew/prompts/{agent}.md` にプロンプトが平文で残存 (CWE-538)。送信完了後の unlink と `.gitignore` への追加を推奨
- [medium] `waitForReady` タイムアウト時のサイレント成功。エージェント未起動状態でプロンプト送信されるリスク (CWE-636)
- [low] プロンプトファイルのパーミッション未設定 (CWE-732)。`mode: 0o600` を推奨
- [low] `sendInitialPrompt` でプロンプト内容に `sanitizeMessage` が適用されていない。`sendNudge` との不整合

#### Architecture
- [critical] (Code Quality C1/C2 と同一) gate 付きフロー + ループフローでプロンプト送信が正しく機能しない設計上の欠陥。`handleGate` と `pollLoop` のオーケストレーションが不十分
- [high] `WorkflowEnginePort.getStageDefinitions()` が同期だが、Port の他全メソッドは async。将来 async に変更する場合にインターフェース破壊的変更になる。`Promise<Result<...>>` に統一推奨
- [medium] `sendInitialPrompt` に `validateAgentName()` がない。`writeInbox` (L260) との不整合。パス構築 (L188) で理論的にディレクトリトラバーサル可能
- [low] `AgentRunner` の `writeInbox`, `getSessionName`, `setSessionName` が `AgentRunnerPort` に未定義 (既存問題)

#### Required Changes
1. [start.ts] `handleGate` にプロンプト送信機能を追加。シグネチャを `handleGate(engine, ctx: PollContext)` に変更し、gate 承認後に `promptAgent` を呼び出す
2. [start.ts] `PollContext` に `currentCycle: number` を追加し、`tryAdvanceStage` 内でサイクル変更検知時に `promptedStageIndex` を -1 にリセットする
3. [AgentRunner.ts:179-193] `sendInitialPrompt` の fs 操作を try/catch で囲み `err()` を返す (`writeInbox` パターンに統一)
4. [schema.ts:4] `role` フィールドに `.regex(/^[a-zA-Z0-9_-]+$/)` を追加しパストラバーサルを防止

#### 後続推奨
1. `start.ts` の非 export 関数 (`buildAgentList`, `buildPrompt`, `tryAdvanceStage`) を export してユニットテスト追加
2. `schema.ts` の `model` フィールドを `z.enum(["claude-opus-4-6", ...])` に変更し unsafe cast を排除
3. `.crew/prompts/` のクリーンアップ (送信後 unlink + .gitignore)
4. `getStageDefinitions` を `async` に統一
5. `promptAgent` を `Result<void, string>` 返却に変更し `waitForReady` エラーも伝播
