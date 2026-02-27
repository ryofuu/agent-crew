---
id: TICKET-019
title: "エージェント間の申し送りをタスクチケット内に集約"
status: closed
assignee: ""
priority: high
depends_on: [TICKET-018]
created_by: orchestrator
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [backend]
estimated_complexity: S
---

# TICKET-019: エージェント間の申し送りをタスクチケット内に集約

## Description

エージェント間のやりとり（実装メモ、レビュー指摘、注意点など）は signal payload の `handoff` ではなく、タスクチケット内のセクション（Implementation Notes, Review Feedback 等）に追記する方針に変更する。

signal payload は処理したタスクIDの軽い通知のみ。プロンプトへの handoff 注入ロジックも不要。

## Acceptance Criteria

- [x] `SignalPayload` から `handoff` フィールド削除
- [x] `buildPrompt` から `handoff` パラメータと Handoff セクション注入を削除
- [x] `promptAgent` から `handoff` パラメータ削除
- [x] `PollContext` から `lastHandoff` フィールド削除
- [x] Implementer テンプレート Phase 5 で Implementation Notes と Files Changed をチケットに追記する指示
- [x] Reviewer テンプレートにレビュー指摘は Review Feedback に記載済みと明記

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/start.ts` | modified | handoff 関連コードをすべて削除 |
| `templates/agents/implementer.md` | modified | Phase 5 にチケット追記指示 |
| `templates/agents/reviewer.md` | modified | Review Feedback への記載を明記 |

## Review Feedback

N/A (手動実装)
