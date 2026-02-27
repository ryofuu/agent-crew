---
id: TICKET-021
title: "REQUEST.md による動的依頼管理"
status: closed
assignee: ""
priority: high
depends_on: []
created_by: orchestrator
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [backend]
estimated_complexity: M
---

# TICKET-021: REQUEST.md による動的依頼管理

## Description

ワークフロー稼働中に依頼内容を変更・追加できるよう `.crew/REQUEST.md` を導入する。追記形式・タイムスタンプ付きで依頼を管理し、完了した依頼にマークをつけると未完了分だけがエージェントに渡される仕組みにする。

## Acceptance Criteria

- [x] `parseRequest` / `getActiveGoal` / `formatNewEntry` 関数を `src/workflow/request.ts` に実装
- [x] `crew init` で `.crew/REQUEST.md` テンプレートが作成される
- [x] `crew start` で goal が REQUEST.md にタイムスタンプ付きで追記される
- [x] `promptAgent` が毎回 REQUEST.md からアクティブな依頼を動的に読み込む
- [x] REQUEST.md がない場合は state.json の goal にフォールバック
- [x] `PollContext` から `goal` フィールドを削除（毎回動的読み込み）
- [x] パーサーのユニットテスト（複数エントリ、done 混在、空ファイル、body なし）
- [x] `bun run typecheck` 型エラーなし
- [x] `bun run lint` Biome 0 エラー
- [x] `bun test` 全テスト通過
- [x] README / README_ja に REQUEST.md セクションを追加

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/workflow/request.ts` | new | REQUEST.md パーサー（parseRequest, getActiveGoal, formatNewEntry） |
| `src/workflow/index.ts` | modified | request.ts の型と関数を re-export |
| `src/cli/commands/start.ts` | modified | writeRequestEntry で REQUEST.md 追記、loadActiveGoal で動的読み込み、promptAgent / PollContext / pollLoop / sendFirstPrompt から goal パラメータ削除 |
| `src/cli/commands/init.ts` | modified | crew init 時に .crew/REQUEST.md テンプレート作成 |
| `tests/workflow/request.test.ts` | new | パーサーのユニットテスト |
| `README.md` | modified | Dynamic Request Management セクション追加 |
| `README_ja.md` | modified | 動的依頼管理セクション追加 |

## Review Feedback

N/A (手動実装)
