---
id: TICKET-011
title: "シグナルファイルによるステージ完了検知の実装"
status: changes_requested
assignee: "implementer-1"
priority: critical
depends_on: [TICKET-010]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: M
---

# TICKET-011: シグナルファイルによるステージ完了検知の実装

## Description

TICKET-010 で実装した pane output ベースの idle 検知（`getStatus()` による `idle` 判定）は
Claude Code の TUI 上で安定動作せず、planner 完了後に implementer へ遷移しない問題が発生した。

エージェントが明示的にシグナルファイル `.crew/signals/{role}.done` を書き出し、
pollLoop がそのファイルの存在を検知してステージ遷移する方式に変更する。

ループ時もファイルは検知後に削除されるため、各サイクルでクリーンに動作する。

## Acceptance Criteria

- [x] エージェントロールテンプレート（planner/implementer/reviewer）に完了時のシグナルファイル書き出し指示を追加
- [x] `start.ts` に `checkSignal()` / `removeSignal()` / `ensureSignalsDir()` ヘルパーを実装
- [x] `tryAdvanceStage()` が pane output ではなくシグナルファイルの存在でステージ完了を判定
- [x] シグナル検知後にファイルを削除し、ループ時の再利用に対応
- [x] `init.ts` で `.crew/signals/` ディレクトリを作成し `.gitignore` に追加
- [x] pane output ベースの idle 検知コード（`isAgentIdle`, `stableCount` 等）を削除
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス

## Implementation Notes

### Relevant Files

- `templates/agents/planner.md` -- planner ロールテンプレート
- `templates/agents/implementer.md` -- implementer ロールテンプレート
- `templates/agents/reviewer.md` -- reviewer ロールテンプレート
- `src/cli/commands/start.ts` -- pollLoop + tryAdvanceStage
- `src/cli/commands/init.ts` -- 初期化コマンド

### Technical Constraints

- シグナルファイルは `echo '{"result":"ok"}' > .crew/signals/{role}.done` で作成
- ファイル検知は `fs.promises.access()` で行う（軽量）
- 検知後は即 `fs.promises.unlink()` で削除（ループ対応）
- pane output 依存のステータス検知は残すが、ステージ遷移判定には使わない

### アーキテクチャ: シグナルファイル方式

```
エージェント作業完了
  ↓
echo '{"result":"ok"}' > .crew/signals/{role}.done
  ↓
pollLoop → checkSignal() → ファイル存在検知
  ↓
removeSignal() → ファイル削除
  ↓
engine.advance() → 次ステージ active
  ↓
promptAgent() → 次エージェントへプロンプト送信
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| templates/agents/planner.md | modify | 完了通知方法をシグナルファイル方式に変更 |
| templates/agents/implementer.md | modify | 完了通知方法をシグナルファイル方式に変更 |
| templates/agents/reviewer.md | modify | 完了通知方法をシグナルファイル方式に変更 |
| src/cli/commands/start.ts | modify | checkSignal/removeSignal/ensureSignalsDir 追加、tryAdvanceStage をシグナル方式に変更 |
| src/cli/commands/init.ts | modify | signals ディレクトリ作成 + .gitignore 追加 |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T16:41:00+09:00)

**Verdict**: CHANGES_REQUESTED

**Test Results**: 109 pass, 0 fail, bun tsc 0 errors, biome 0 errors

#### Code Quality
- [high] `checkSignal` + `removeSignal` の TOCTOU レースコンディション (CWE-367)。`fs.promises.access` で存在確認してから `unlink` するまでの間に別プロセスがファイルを操作する可能性がある。`consumeSignal`（unlink ベースのアトミック操作）に統合すべき
- [high] `signalPath` (start.ts:102-103) で `role` が未検証のまま `path.join` に渡される。`role: "../../etc/important"` のような値で `.crew/signals/` 外のファイルの存在確認 + 削除が可能 (CWE-22)。TICKET-010 R1 H4 と同根の問題だが、TICKET-011 で `removeSignal` (unlink) が加わり影響範囲が拡大。ローカルバリデーション追加が必要
- [medium] `PollContext.promptedStageIndex` (start.ts:136,183,205) がデッドコード化。L183 で更新されるが参照されない。混乱を招くため削除すべき
- [medium] `checkSignal`/`removeSignal`/`ensureSignalsDir`/`tryAdvanceStage`（シグナル版）のユニットテストが不在。全て start.ts の非 export 関数であるためテスト困難な構造。統合テストレベルでもシグナル検知フローのテストがない
- [low] シグナルファイルの内容（`{"result":"ok"}`）が検証されていない。`checkSignal` は存在確認のみ。現時点では問題ないが、将来エラーシグナル導入時に拡張が必要

#### Security
- [high] `signalPath` のパストラバーサル (CWE-22)。上記 Code Quality と同一。`removeSignal` で任意パスのファイル削除につながりうる
- [medium] シグナルファイル偽造によるステージ不正遷移。エージェント以外のプロセスや手動操作で `{role}.done` を作成するとステージが遷移する。ローカル CLI ツールとしては低リスクだが認識しておくべき
- [low] `ensureSignalsDir` でパーミッション未設定 (CWE-732)。マルチユーザー環境でリスク。`mode: 0o700` 推奨

#### Architecture
- [high] シグナルファイル操作 (`signalPath`, `checkSignal`, `removeSignal`, `ensureSignalsDir`) が CLI 層 (start.ts) にローカル関数として配置されている。シグナル検知は「ステージ完了の判定」であり Workflow Engine 層の責務。他のファイル操作（state.json → workflow/state.ts, inbox → AgentRunner.ts）と比較してパターン不統一。`src/workflow/signals.ts` への分離または `WorkflowEngine.checkStageCompletion()` への統合を推奨
- [high] start.ts が 332 行に膨張し、10 個の非 export 関数を含む。エージェントリスト構築、プロンプト構築/送信、シグナル操作、ポーリング/オーケストレーション、CLI エントリポイントの 5 つの関心が混在
- [medium] `pollLoop` 内で `engine.getState()` が 1 サイクルあたり最大 3 回呼ばれる (L209, L143, L168)。ファイル I/O を伴うため非効率。`tryAdvanceStage` に state を引数で渡すべき

#### Required Changes
1. [start.ts:106-121] `checkSignal` + `removeSignal` を `consumeSignal`（unlink ベースのアトミック操作）に統合し TOCTOU を解消
2. [start.ts:102-103] `signalPath` にロール名バリデーション追加 (`/^[a-zA-Z0-9_-]+$/`)。多層防御として schema.ts 修正前でも防御

#### 後続推奨
1. シグナルファイル操作を `src/workflow/signals.ts` に切り出し、Workflow Engine 層に移動
2. start.ts の非 export 関数を export するか、モジュール分割でテスト容易性を改善
3. `PollContext.promptedStageIndex` デッドコードを削除
4. `getState()` の呼び出し回数を 1 サイクル 1 回に削減
