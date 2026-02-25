# Project Context: agent-crew

全ロール（Planner/Implementer/Reviewer/Orchestrator）が参照する共有コンテキスト。

## プロジェクト概要

**agent-crew** は、Claude Code + OpenAI Codex を使った小規模精鋭 AI エージェントチームによる自動開発サイクルを実現する CLI ツール。

### 解決する課題

既存ツール（shogun）の問題:
- 5ホップの情報伝達遅延による情報劣化
- プロジェクト間のコンテキスト汚染

### コアコンセプト

- **Choreography > Orchestration**: タスクファイル駆動で自律協調（中央制御なし）
- **タスクファイル = 契約**: エージェント間通信の唯一の真実
- **コンテキストリセットは美徳**: タスクごとにリセットしてコンテキスト汚染を防止
- **最小エージェント原則**: 3〜4エージェントのみ（Opus + Codex）

## 現在のマイルストーン

**Phase 1 (MVP)** — dev-cycle ワークフロー最小動作版

スコープ:
- dev-cycle ワークフローのみ（Planner→Implementer→Reviewer→loop）
- 3エージェント（Planner/claude-opus-4-6, Implementer/codex-1, Reviewer/claude-opus-4-6）
- tmux ペイン表示
- セミオート遷移（ポーリングベース + human_gate）
- `crew init`, `crew start`, `crew status`, `crew stop`, `crew list`

## 技術スタック

- **Runtime**: Bun ≥ 1.2
- **Language**: TypeScript strict
- **UI**: tmux ≥ 3.3
- **ライブラリ**: js-yaml, gray-matter, Zod, Biome (lint/format)
- **テスト**: bun:test

## アーキテクチャ概要

### 4モジュール構成

```
CLI Module
  ├─ Workflow Engine Module  (状態機械、フェーズ遷移管理)
  ├─ Agent Runner Module     (エージェント生死、tmux管理、nudge送信)
  └─ Task Store Module       (タスクファイル CRUD、変更監視)
```

### ディレクトリ構造

```
src/
├── cli/           # CLI Module (commander.js)
├── workflow/      # Workflow Engine Module
├── runner/        # Agent Runner Module
├── store/         # Task Store Module
└── kernel/        # Shared Kernel (型定義、Result型)
templates/         # ビルトインワークフロー YAML（dev-cycle等）
tests/
```

### ファイルベース永続化（DBなし）

- `.crew/state.json` — ワークフロー状態（atomic write）
- `.crew/tasks/TASK-{NNN}.md` — タスクファイル（YAML frontmatter + Markdown本文）
- `.crew/tasks/_counter.txt` — ID カウンタ
- `.crew/workflows/*.yaml` — ワークフロー定義
- `.crew/config.yaml` — プロジェクト設定
- `.crew/inbox/{agent_name}.md` — Stop Hook 経由受信トレイ

## 重要な技術的判断

### 共有カーネル型

```typescript
type TaskStatus = 'todo' | 'in_progress' | 'dev_done' | 'in_review' | 'blocked' | 'changes_requested' | 'closed'
type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'
type AgentStatus = 'idle' | 'active' | 'error' | 'stopped'
type ModelId = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'codex-1' | 'codex-mini-latest'
type CliType = 'claude-code' | 'codex'
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

### CLI コマンド

```
crew init [--force]          # プロジェクト初期化
crew start <workflow> "<goal>" [--resume]   # ワークフロー開始
crew status                  # 状態確認
crew stop [--force]          # 停止
crew list                    # ワークフロー一覧
crew doctor                  # 前提条件チェック
```

### ワークフロー定義（YAML）の解決優先順

1. プロジェクト `.crew/workflows/`
2. ユーザー `CREW_HOME/workflows/`
3. ビルトイン CLI テンプレート（`templates/`）

## 既知の制約・注意事項

- **Codex TUI 制限**: send-keys で `text → 0.3s sleep → Enter` の順で送信が必要
- **tmux session 名**: `crew-{project_name}` 形式
- **atomic write 必須**: ファイル書き込みは tmp ファイル作成 → rename パターン
- **ステータス遷移バリデーション**: TaskStore で一元管理
- **エラーコード定義**: PRD `06-module-contracts.md` に定義済み
- **ファイル監視**: 外部依存なしの 1秒ポーリング（mtime キャッシュ + grep fast-path）
- **3フェーズエスカレーション**: 標準nudge → CLI固有リセット → コンテキストリセット+タスク再投入
