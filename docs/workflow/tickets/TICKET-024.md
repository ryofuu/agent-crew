---
id: TICKET-024
title: "Implementer: 独立タスクの AgentTeam 並列実装 & 日本語コメント必須化"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [template]
estimated_complexity: S
---

# TICKET-024: Implementer: 独立タスクの AgentTeam 並列実装 & 日本語コメント必須化

## Description

Implementer テンプレートを改善。独立タスク（depends_on なし・ファイル重複なし）が複数ある場合に AgentTeam（Task tool）で並列実装できるようにする。また、コードに日本語コメントを書くルールを追加。

## Acceptance Criteria

- [x] タスクを independent / sequential に分類するロジックを Step 2 に追加
- [x] 独立タスク2つ以上 → AgentTeam で並列実装
- [x] それ以外 → 従来通り逐次実装
- [x] 品質チェック（typecheck/lint/test）を全タスク完了後にまとめて1回実行する Step 4 に分離
- [x] コーディングルール追加: 関数・クラスに日本語コメント必須（引数・戻り値の逐一説明は不要、一目でわかることが目的）

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/implementer.md` | modified | 並列実装フロー追加、品質チェック分離、コーディングルール追加 |
