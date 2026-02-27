---
id: TICKET-029
title: "シグナルファイル残留バグ修正 & オーケストレーターログ出力"
status: closed
assignee: ""
priority: critical
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [bugfix, cli]
estimated_complexity: M
---

# TICKET-029: シグナルファイル残留バグ修正 & オーケストレーターログ出力

## Description

### バグ: シグナルファイル残留で全ステージが即advance

`crew start` 時に `.crew/signals/` の前回残存シグナルを削除していなかった。前回の `planner.done`, `implementer.done` 等が残っていると、poll loop が起動直後にそれを拾って全ステージを一瞬で通過してしまう。

### 機能: オーケストレーターログのファイル出力

`console.log` のみでファイルに保存していなかったため、問題発生時のデバッグが困難だった。`.crew/logs/` にタイムスタンプ付きログファイルを出力する。

## Acceptance Criteria

- [x] `ensureSignalsDir` → `cleanSignalsDir` に変更。ワークフロー開始時に signals 内の全ファイルを削除
- [x] `CrewLogger` クラス追加: ファイル + stdout/stderr の両方に出力
- [x] poll loop 内の全 console.log/error を logger 経由に変更
- [x] ログファイルにタイムスタンプ付きで全イベントを記録
- [x] ループ検知時のログを追加

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/start.ts` | modified | `cleanSignalsDir`、`CrewLogger`、poll loop のログ出力をファイル化 |
