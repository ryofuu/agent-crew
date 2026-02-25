---
id: TICKET-007
title: "dev-cycle テンプレート + エージェント起動プロンプト（AGENTS.md）"
status: dev_done
assignee: "implementer-1"
priority: medium
depends_on: [TICKET-004, TICKET-005]
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [backend]
estimated_complexity: S
---

# TICKET-007: dev-cycle テンプレート + エージェント起動プロンプト（AGENTS.md）

## Description

ビルトイン dev-cycle ワークフロー YAML テンプレートと、各エージェント（Planner/Implementer/Reviewer）が起動時に読み込む AGENTS.md ファイルを作成する。
これにより、エージェントが自分のロールと作業方法を把握できる。

## Acceptance Criteria

- [x] `templates/dev-cycle.yaml` が Zod バリデーションを通過する
- [x] `templates/agents/planner.md` が Planner の役割・作業フローを説明している
- [x] `templates/agents/implementer.md` が Implementer の役割・作業フローを説明している
- [x] `templates/agents/reviewer.md` が Reviewer の役割・作業フローを説明している
- [x] エージェント起動時に CWD で AGENTS.md を参照する設計

## Implementation Notes

### Relevant Files

- `templates/dev-cycle.yaml` — dev-cycle ワークフロー定義
- `templates/agents/planner.md` — Planner 向け AGENTS.md
- `templates/agents/implementer.md` — Implementer 向け AGENTS.md
- `templates/agents/reviewer.md` — Reviewer 向け AGENTS.md
- `src/runner/AgentRunner.ts` — 起動時の AGENTS.md パス注入箇所

### Technical Constraints

- AGENTS.md は Claude Code / Codex が起動時に `CLAUDE.md` や `AGENTS.md` として自動読み込みする仕組みを活用
- エージェント起動時に CWD を `.crew/` 配下の agent 別ディレクトリにし、そこに AGENTS.md をコピー or symlink する設計も検討
- Implementer は Codex であるため、AGENTS.md の形式は Codex の仕様に合わせる

### AGENTS.md の必須セクション

各 AGENTS.md は以下を含む:
1. **あなたのロール**: 一文で説明
2. **やること**: 箇条書き
3. **タスクファイルの場所**: `.crew/tasks/TASK-{NNN}.md`
4. **ステータス更新方法**: ファイルの frontmatter を直接編集する
5. **完了通知方法**: タスクファイルの status を `dev_done` / `closed` に更新する
6. **やらないこと**: 境界の明確化

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `templates/agents/planner.md` | created | Planner 向け AGENTS.md |
| `templates/agents/implementer.md` | created | Implementer 向け AGENTS.md |
| `templates/agents/reviewer.md` | created | Reviewer 向け AGENTS.md |
| `tests/workflow/schema.test.ts` | created | dev-cycle.yaml Zod バリデーションテスト |

## Blocker

## Review Feedback
