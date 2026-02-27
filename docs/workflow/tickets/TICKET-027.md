---
id: TICKET-027
title: "ワークフロー定義をエージェントのプロンプトに含める"
status: closed
assignee: ""
priority: medium
depends_on: []
created_by: human
created_at: "2026-02-27T00:00:00+09:00"
updated_at: "2026-02-27T00:00:00+09:00"
labels: [cli]
estimated_complexity: S
---

# TICKET-027: ワークフロー定義をエージェントのプロンプトに含める

## Description

各エージェントがワークフロー全体像（どのロールがどの順で実行されるか）を把握できるように、ワークフロー定義YAMLをプロンプトに含める。ユーザーが途中で介入する際にもロール名で指示しやすくなる。

## Acceptance Criteria

- [x] `buildPrompt` にワークフローYAMLを含める
- [x] 「あなたは以下のワークフローの中で実行されています。あなたの役割は "xxx" ステージです。」の説明文を付与

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/start.ts` | modified | `loadWorkflowYaml` 追加、`buildPrompt` に role と workflowYaml 引数追加 |
