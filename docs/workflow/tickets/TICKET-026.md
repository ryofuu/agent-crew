---
id: TICKET-026
title: "CONTEXT.md と LOG.md の役割分離"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [template, cli]
estimated_complexity: S
---

# TICKET-026: CONTEXT.md と LOG.md の役割分離

## Description

CONTEXT.md にPlannerのセッション作業履歴が蓄積され、全ロール共有の重要情報が埋もれる問題への対策。CONTEXT.md は重要な共有知識のみに限定し、セッション作業記録は新設の LOG.md に分離する。

### 問題

実運用で CONTEXT.md の後半がPlannerの「第N回セッション」の作業記録で肥大化。Implementer/Reviewer にとって不要な情報がノイズになっていた。

### 解決方針

| ファイル | 書く内容 | 書かない内容 |
|----------|---------|-------------|
| `.crew/CONTEXT.md` | 技術選定、規約、横断的な注意事項 | セッション作業記録 |
| `.crew/LOG.md` | セッションごとの作業履歴 | — |
| タスクチケット | タスク固有の実装詳細 | — |

## Acceptance Criteria

- [x] Planner テンプレート Step 5: CONTEXT.md には重要な知識のみ、LOG.md に作業記録を書くよう分離
- [x] CONTEXT.md テンプレートの説明を更新（セッション記録は LOG.md へ）
- [x] `crew init` で `.crew/LOG.md` を自動生成

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/planner.md` | modified | Step 5 を CONTEXT.md（重要知識のみ）と LOG.md（作業記録）に分離 |
| `templates/CONTEXT.md` | modified | テンプレートの説明を更新 |
| `src/cli/commands/init.ts` | modified | LOG.md の自動生成を追加 |
