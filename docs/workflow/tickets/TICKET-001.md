---
id: TICKET-001
title: "プロジェクト初期化: package.json / tsconfig / biome / bunfig"
status: closed
assignee: "implementer-1"
priority: critical
depends_on: []
created_by: planner
created_at: "2026-02-25T00:00:00+09:00"
updated_at: "2026-02-25T00:00:00+09:00"
labels: [infra]
estimated_complexity: S
---

# TICKET-001: プロジェクト初期化: package.json / tsconfig / biome / bunfig

## Description

agent-crew プロジェクトの基盤ファイルを作成する。
Bun + TypeScript strict + Biome の環境をセットアップし、後続の全チケットが参照できるプロジェクト設定を確立する。

## Acceptance Criteria

- [x] `package.json` に `name: "agent-crew"`, `bin.crew` エントリポイント定義あり
- [x] `tsconfig.json` が `strict: true`, `moduleResolution: "bundler"` で設定されている
- [x] `biome.json` が lint/format ルール付きで設定されている
- [x] `bunfig.toml` に `[test]` セクションあり
- [x] `bun run typecheck` がエラーなく通る（空のエントリポイントで確認）
- [x] `bun run lint` が通る

## Implementation Notes

### Relevant Files

- `package.json` — 新規作成
- `tsconfig.json` — 新規作成
- `biome.json` — 新規作成
- `bunfig.toml` — 新規作成
- `src/index.ts` — エントリポイント（スタブ）

### Technical Constraints

- Bun ≥ 1.2 を前提とする
- TypeScript: `"moduleResolution": "bundler"`, `"strict": true`, `"target": "ES2022"`
- Biome を lint + format 両方に使用（ESLint/Prettier は使わない）
- `bin` フィールド: `"crew": "./src/index.ts"` として bun で直接実行可能にする
- devDependencies: `@biomejs/biome`, `typescript`
- dependencies: `commander`, `js-yaml`, `gray-matter`, `zod`

### package.json scripts

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --target=bun --outfile=dist/crew",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `package.json` | created | name, bin, scripts, dependencies, devDependencies 定義 |
| `tsconfig.json` | created | strict: true, moduleResolution: bundler, bun-types |
| `biome.json` | created | lint/format ルール（tab indent, lineWidth: 100） |
| `bunfig.toml` | created | [test] セクション |
| `src/index.ts` | created | エントリポイントスタブ |

## Blocker

## Review Feedback

### Round 1 (2026-02-25T12:00:00+09:00)

**Verdict**: APPROVED

#### Code Quality
- [low] `package.json`, `tsconfig.json` がスペースインデントで Biome のタブインデント規約と不一致。`bun run format` で自動修正可能。

#### Security
- なし

#### Architecture
- なし

#### Required Changes
なし（low の指摘は自動修正可能な範囲）
