---
id: TICKET-018
title: "シグナルファイルにペイロード（タスクID一覧）を追加"
status: closed
assignee: ""
priority: high
depends_on: [TICKET-011]
created_by: orchestrator
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [backend]
estimated_complexity: M
---

# TICKET-018: シグナルファイルにペイロード（タスクID一覧）を追加

## Description

`.crew/signals/{role}.done` シグナルファイルを単純な存在確認から JSON ペイロード読み取りに変更する。
各エージェントが処理したタスクID一覧をシグナルに含め、ワークフロー進行時にログ出力する。

詳細な申し送り事項はタスクチケット内に記載する方針とし、シグナルは軽い通知に限定する。

## Acceptance Criteria

- [x] `SignalPayload` インターフェース定義（`result`, `tasks?`）
- [x] `checkSignal`（存在確認）→ `readSignal`（JSON パース）に置き換え
- [x] `tryAdvanceStage` でペイロードの `tasks` をログ出力
- [x] 3つのエージェントテンプレートがタスクID一覧付き JSON を書く指示に更新

## Implementation Notes

- `readSignal` は JSON パースに失敗した場合 `null` を返す（後方互換）
- `handoff` フィールドは不要と判断し除去。申し送りはタスクチケット内に記載する方針

### Relevant Files

- `src/cli/commands/start.ts` -- SignalPayload, readSignal, tryAdvanceStage
- `templates/agents/planner.md` -- Phase 6 更新
- `templates/agents/implementer.md` -- Phase 6 更新
- `templates/agents/reviewer.md` -- Phase 5 更新

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/start.ts` | modified | SignalPayload 追加、checkSignal→readSignal、tasks ログ出力 |
| `templates/agents/planner.md` | modified | 完了通知を tasks 付き JSON に変更 |
| `templates/agents/implementer.md` | modified | 完了通知を tasks 付き JSON に変更、Phase 5 にチケット追記指示追加 |
| `templates/agents/reviewer.md` | modified | 完了通知を tasks 付き JSON に変更 |

## Review Feedback

N/A (手動実装)
