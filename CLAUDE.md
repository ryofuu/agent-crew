# agent-crew

AI エージェントチームによる自動開発サイクルを実現する CLI ツール。

## 技術スタック

- **Runtime**: Bun ≥ 1.2
- **Language**: TypeScript strict
- **UI**: tmux ≥ 3.3
- **Lint/Format**: Biome（tab indent, lineWidth: 100）
- **Test**: bun:test
- **Libraries**: commander, js-yaml, gray-matter, zod

## コマンド

```bash
bun run typecheck   # 型チェック
bun run lint        # Biome lint
bun run format      # Biome format
bun test            # 全テスト実行
bun run dev         # CLI 実行
```

## アーキテクチャ

```
src/
├── cli/           # CLI Module (commander)
│   ├── commands/  # init, start, status, stop, list, doctor
│   └── config.ts  # .crew/config.yaml
├── workflow/      # Workflow Engine Module
│   ├── schema.ts  # Zod ワークフロー定義
│   ├── state.ts   # state.json read/write
│   └── WorkflowEngine.ts
├── runner/        # Agent Runner Module
│   ├── tmux.ts    # tmux ラッパー
│   ├── adapters/  # ClaudeCode / Codex アダプター
│   └── AgentRunner.ts
├── store/         # Task Store Module
│   ├── transitions.ts  # ステータス遷移マトリクス
│   └── TaskStore.ts
├── kernel/        # Shared Kernel
│   ├── types.ts   # 共有型定義
│   ├── result.ts  # Result<T,E>
│   └── errors.ts  # エラーコード定数
└── index.ts       # エントリポイント
templates/         # ビルトインテンプレート
tests/             # テスト（ディレクトリ構造は src/ に対応）
```

## コーディング規約

- Biome で lint/format（tab indent）
- Result 型でエラーハンドリング（throw しない）
- ファイル書き込みは atomic（tmp → rename）
- Port パターン（インターフェース定義 → 実装）
- テストは `tests/` 配下に `src/` と同構造で配置
