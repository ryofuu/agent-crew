---
id: TICKET-013
title: "ゲート承認後にエージェントへプロンプトが送信されないバグの修正"
status: closed
assignee: "implementer-1"
priority: critical
depends_on: [TICKET-010, TICKET-011]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [bugfix]
estimated_complexity: S
---

# TICKET-013: ゲート承認後にエージェントへプロンプトが送信されないバグの修正

## Description

`dev-cycle` ワークフローの plan ステージ（`human_gate: true`）で、ゲート承認後に
planner エージェントが開始されない。Claude Code セッションは tmux 上で起動しているが、
初期プロンプトが送信されないため、エージェントが待機状態のまま何も実行しない。

`simple-flow`（`human_gate: false`）は正常に動作する。

## Root Cause

3 つの問題が複合:

1. **初期プロンプト送信のスキップ**: `startCommand` で `stage?.status === "active"` の場合のみプロンプトを送信。`human_gate: true` のステージは `waiting_gate` で開始されるためスキップされる
2. **ゲート承認後のプロンプト欠如**: `handleGate()` はゲート承認で `active` に遷移させるが、プロンプト送信処理がない。承認後に `pollLoop` に戻っても、`tryAdvanceStage` はシグナル検知のみでプロンプト送信しない
3. **promptedStageIndex の誤初期化**: `PollContext.promptedStageIndex` が常に `0` で初期化されるため、未プロンプトのステージ 0 を「送信済み」と誤認。ループ時のリセットも未実装

TICKET-010 R1 レビュー Required Change #1 (gate 承認後のプロンプト未送信) および
#2 (ループ時の promptedStageIndex 未リセット) で指摘されていた問題。

## Acceptance Criteria

- [x] `human_gate: true` のステージでゲート承認後にエージェントへプロンプトが送信される
- [x] `promptedStageIndex` が初期プロンプト未送信時は `-1` で初期化される
- [x] ループ時（ステージ index が巻き戻る）に `promptedStageIndex` がリセットされる
- [x] `simple-flow` の動作に影響なし
- [x] `bun run typecheck` / `bun run lint` / `bun test` が全パス

## Implementation

### Changes

1. **`promptIfNeeded()` 関数追加** — `pollLoop` の各イテレーションで `handleGate` 後に呼出し。現在のステージが `active` かつ未プロンプトなら `promptAgent` を実行
2. **`promptedStageIndex` 初期値を動的化** — 初期プロンプト送信時に `idx` を設定、未送信時は `-1`
3. **ループ検知でリセット** — `tryAdvanceStage` で `nextIdx < state.currentStageIndex` の場合に `promptedStageIndex = -1`

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| src/cli/commands/start.ts | modify | `promptIfNeeded()` 追加、`pollLoop` に `promptedStageIndex` パラメータ追加、ループ時リセット |

## Review Feedback

N/A — 手動テストで dev-cycle 動作確認済み
