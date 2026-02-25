# agent-crew

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) と [OpenAI Codex](https://openai.com/index/openai-codex/) による AI エージェントチームの自動開発サイクルを実現する CLI ツール。

> **[English README](./README.md)**

## 概要

agent-crew は Planner・Implementer・Reviewer の 3 エージェントを tmux 上で協調動作させます。エージェント間の通信はタスクファイル（Markdown + YAML frontmatter）のみ。中央制御なしの Choreography 方式で自律的に開発を進めます。

```
Plan → Implement → Review → loop（完了まで繰り返し）
```

### 設計思想

- **Choreography > Orchestration** — タスクファイルが唯一の真実。中央制御なし
- **コンテキストリセットは美徳** — タスクごとにリセットしてコンテキスト汚染を防止
- **最小エージェント原則** — 3〜4 エージェントのみ（Opus + Codex）
- **ファイルベース永続化** — DB 不要。`.crew/` 配下の Markdown と YAML で完結

## 前提条件

| ツール | バージョン | 用途 |
|--------|-----------|------|
| [Bun](https://bun.sh) | >= 1.2 | ランタイム |
| [tmux](https://github.com/tmux/tmux) | >= 3.3 | エージェント UI |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | 最新 | Planner・Reviewer |
| [Codex CLI](https://github.com/openai/codex) | 最新 | Implementer |

確認コマンド:

```bash
crew doctor
```

## インストール

```bash
git clone https://github.com/yourname/agent-crew.git
cd agent-crew
bun install
bun link   # `crew` コマンドをグローバルに登録
```

## クイックスタート

```bash
# 1. プロジェクトで初期化
cd your-project
crew init

# 2. 開発サイクルを開始
crew start dev-cycle "JWT を使ったユーザー認証機能の追加"

# 3. 状態を確認
crew status

# 4. 完了後に停止
crew stop
```

## CLI コマンド

| コマンド | 説明 |
|---------|------|
| `crew init [--force]` | `.crew/` ディレクトリをプロジェクトに作成 |
| `crew start <workflow> "<goal>" [--auto-approve] [--nudge-interval <sec>]` | ワークフローを開始 |
| `crew status` | ワークフロー状態・タスク一覧・エージェント状態を表示 |
| `crew stop [--force]` | 全エージェント停止、tmux セッション破棄 |
| `crew list` | 利用可能なワークフロー定義を一覧表示 |
| `crew doctor` | 前提条件のインストール状況を確認 |

## 動作の仕組み

### ワークフロー

```
crew start dev-cycle "機能 X を実装"
         │
         ▼
┌─────────────────┐
│   Plan (Opus)   │◄── human_gate: 承認後に次へ
│   - ゴール分析  │
│   - タスク作成  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Implement (Codex)│
│   - タスク選択  │
│   - コード実装  │
│   - テスト実行  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Review (Opus)  │◄── human_gate: 承認後にループ判定
│   - コード品質  │
│   - セキュリティ│
│   - 設計整合性  │
└────────┬────────┘
         │
    ┌────┴────┐
    │修正必要？│──はい──► Implement に戻る
    └────┬────┘
         │ いいえ
         ▼
       完了
```

### タスクファイル形式

タスクは `.crew/tasks/` に YAML frontmatter 付き Markdown で保存:

```markdown
---
id: TASK-001
title: "ユーザーログイン実装"
status: todo
assignee: ""
priority: high
depends_on: []
created_at: "2026-02-25T00:00:00Z"
updated_at: "2026-02-25T00:00:00Z"
stage: "implement"
labels: [backend, auth]
---

# TASK-001: ユーザーログイン実装

## Description
...

## Acceptance Criteria
- [ ] POST /api/login エンドポイント
- [ ] JWT トークン生成
```

### タスクステータス遷移

```
todo → in_progress → dev_done → in_review → closed
          ↓                        ↓
        blocked              changes_requested
                                   ↓
                              in_progress → ...
```

## ワークフロー定義

YAML でワークフローを定義。ビルトインの `dev-cycle` テンプレート:

```yaml
name: dev-cycle
description: "Plan → Implement → Review → loop"
loop_on_changes: true
max_cycles: 10
stages:
  - name: plan
    role: planner
    model: claude-opus-4-6
    human_gate: true
    context_reset: false
  - name: implement
    role: implementer
    model: codex-1
    human_gate: false
    context_reset: true
  - name: review
    role: reviewer
    model: claude-opus-4-6
    human_gate: true
    context_reset: true
    on_complete: [loop, close]
```

### ワークフロー解決順序

1. プロジェクト: `.crew/workflows/`（任意、必要に応じて手動作成）
2. ユーザー: `~/.crew/workflows/`
3. ビルトイン: `templates/`

## 設定

グローバル設定は `~/.crew/config.yaml`（`crew init` で未存在時に自動作成）:

```yaml
defaults:
  planner_model: claude-opus-4-6
  implementer_model: codex-1
  reviewer_model: claude-opus-4-6
tmux:
  session_prefix: crew
agent:
  nudge_interval_seconds: 300  # idle 検知間隔（--nudge-interval で上書き可）
  max_escalation_phase: 3      # ステージあたりの最大ナッジ回数
  auto_approve: false
workflow:
  poll_interval_seconds: 5
```

プロジェクト名はカレントディレクトリ名（`path.basename(cwd)`）から自動取得。

`CREW_HOME` 環境変数でデフォルトの `~/.crew` を変更可能。

## アーキテクチャ

```
src/
├── cli/           # CLI モジュール (commander.js)
│   ├── commands/  # init, start, status, stop, list, doctor
│   └── config.ts  # ~/.crew/config.yaml 読み書き
├── workflow/      # Workflow Engine — 状態機械、YAML パース
├── runner/        # Agent Runner — tmux 管理、エージェント起動/停止
├── store/         # Task Store — CRUD、ステータス遷移、ファイル監視
├── kernel/        # Shared Kernel — Result<T,E>、型定義、エラーコード
└── index.ts       # エントリポイント
```

### 技術的な設計判断

- **Result\<T, E\>** で全エラーハンドリング（throw しない）
- **Atomic write**（tmp ファイル → rename）で全ファイル書き込み
- **Port パターン**（`types.ts` にインターフェース定義、実装は別ファイル）
- **Zod バリデーション** をシステム境界で適用

## 開発

```bash
bun install          # 依存インストール
bun run typecheck    # TypeScript strict チェック
bun run lint         # Biome lint
bun run format       # Biome format
bun test             # 全テスト実行
bun run dev          # 開発用 CLI 実行
```

## ステータス

**Phase 1 (MVP)** — dev-cycle ワークフロー + 3 エージェント。動作するが初期段階。

詳細は [status board](./docs/workflow/status.md) を参照。

## ライセンス

MIT
