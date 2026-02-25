---
id: TICKET-009
title: "templates/simple-flow.yaml 追加: ゲートなし・ループなしの簡易ワークフロー"
status: closed
assignee: "implementer-1"
priority: medium
depends_on: []
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: S
---

# TICKET-009: templates/simple-flow.yaml 追加: ゲートなし・ループなしの簡易ワークフロー

## Description

Phase 1 MVP 完了後の動作確認用に、human_gate なし・ループなしの簡易テンプレートを追加する。
既存の `dev-cycle.yaml` は human_gate + loop_on_changes ありで手軽な検証には重いため、
Plan → Implement → Review を一直線に実行する `simple-flow.yaml` を作成する。

## Acceptance Criteria

- [x] `templates/simple-flow.yaml` が作成されている
- [x] 3ステージ構成: plan → implement → review
- [x] `loop_on_changes: false`, `max_cycles: 1`, 全ステージ `human_gate: false`
- [x] `WorkflowDefinitionSchema` の Zod バリデーションを通過する
- [x] `tests/workflow/schema.test.ts` にバリデーションテスト追加
- [x] `bun run dev -- list` で `simple-flow (builtin)` が表示される

## Implementation Notes

### Relevant Files

- `templates/dev-cycle.yaml` -- 既存テンプレート（踏襲すべきパターン）
- `tests/workflow/schema.test.ts` -- スキーマバリデーションテスト
- `src/workflow/schema.ts` -- Zod スキーマ定義

### Technical Constraints

- ワークフロー定義は既存の `WorkflowDefinitionSchema` に準拠
- テストは既存の dev-cycle.yaml テストと同じパターンで記述

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| templates/simple-flow.yaml | add | ゲートなし・ループなしの3ステージワークフロー定義 |
| tests/workflow/schema.test.ts | modify | simple-flow.yaml のスキーマバリデーションテスト追加 |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T21:00:00+09:00)

**Verdict**: APPROVED

**Test Results**: 106 pass, 0 fail, bun tsc 0 errors, biome 0 errors

#### Code Quality
- なし。YAML テンプレートは dev-cycle.yaml のパターンを正確に踏襲。テストも既存パターンと同形式

#### Security
- なし

#### Architecture
- なし。3ステージ構成、gate/loop 無効は AC 通り。`crew list` で `simple-flow (builtin)` 表示確認済み

#### Required Changes
なし
