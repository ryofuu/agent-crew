---
id: TICKET-020
title: "startCommand の cognitive complexity 解消（関数分割）"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: orchestrator
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [backend]
estimated_complexity: S
---

# TICKET-020: startCommand の cognitive complexity 解消（関数分割）

## Description

Biome lint の `noExcessiveCognitiveComplexity` エラー（complexity 18、上限 15）を解消するため、`startCommand` から2つの関数を抽出する。

## Acceptance Criteria

- [x] `spawnAgents` 関数を抽出（エージェント生成ループ）
- [x] `sendFirstPrompt` 関数を抽出（初期プロンプト送信）
- [x] `startCommand` の cognitive complexity が 15 以下
- [x] Biome lint 0 エラー
- [x] 全テスト通過

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/start.ts` | modified | spawnAgents, sendFirstPrompt を抽出 |
| `src/cli/index.ts` | modified | --keep-session オプションの format 修正 |

## Review Feedback

N/A (手動実装)
