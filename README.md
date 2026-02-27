# agent-crew

A CLI tool that orchestrates autonomous AI agent teams for automated development cycles, powered by [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/).

> **[日本語版 README はこちら](./README_ja.md)**

## Overview

agent-crew coordinates a small team of AI agents — Planner, Implementer, and Reviewer — running in tmux panes. Agents communicate through task files (Markdown + YAML frontmatter) with no central controller. Each agent reads and writes task files autonomously, following a choreography-based workflow.

```
Plan → Implement → Review → loop (until done)
```

### Core Principles

- **Choreography over Orchestration** — Task files are the single source of truth; no central controller
- **Context Reset is a Virtue** — Each task starts with a clean context to prevent pollution
- **Minimal Agent Principle** — 3-4 agents only (Opus for planning/review, Codex for implementation)
- **File-based Persistence** — No database; everything is `.crew/` Markdown and YAML

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh) | >= 1.2 | Runtime |
| [tmux](https://github.com/tmux/tmux) | >= 3.3 | Agent UI |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | latest | Planner & Reviewer agent |
| [Codex CLI](https://github.com/openai/codex) | latest | Implementer agent |

Verify with:

```bash
crew doctor
```

## Installation

```bash
git clone https://github.com/yourname/agent-crew.git
cd agent-crew
bun install
bun link   # makes `crew` available globally
```

## Quick Start

```bash
# 1. Initialize in your project
cd your-project
crew init

# 2. Start a dev cycle
crew start dev-cycle "Add user authentication with JWT"

# 3. Check status
crew status

# 4. Stop when done
crew stop
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `crew init [--force]` | Initialize `.crew/` directory in current project |
| `crew start <workflow> "<goal>" [--auto-approve] [--nudge-interval <sec>]` | Start a workflow with the given goal |
| `crew status` | Show workflow state, tasks, and agent status |
| `crew stop [--force]` | Stop all agents and destroy tmux session |
| `crew list` | List available workflow definitions |
| `crew doctor` | Check that all prerequisites are installed |

## How It Works

### Workflow Lifecycle

```
crew start dev-cycle "Build feature X"
         │
         ▼
┌─────────────────┐
│   Plan (Opus)   │◄── human_gate: approve before proceeding
│   - Analyze goal│
│   - Create tasks│
└────────┬────────┘
         ▼
┌─────────────────┐
│ Implement (Codex)│
│   - Pick tasks  │
│   - Write code  │
│   - Run tests   │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Review (Opus)  │◄── human_gate: approve before looping
│   - Code quality│
│   - Security    │
│   - Architecture│
└────────┬────────┘
         │
    ┌────┴────┐
    │ Changes │──yes──► back to Implement
    │ needed? │
    └────┬────┘
         │ no
         ▼
       Done
```

### Dynamic Request Management (REQUEST.md)

`.crew/REQUEST.md` allows you to add, modify, or complete requests while a workflow is running. Each stage's agent reads only the active (non-done) requests, so you can intervene mid-workflow without restarting.

```markdown
# Request

## [2026-02-27 14:30] Add user authentication

Implement login with email/password and JWT tokens.

## [done] [2026-02-27 14:45] Create database tables

Add users table.

## [2026-02-27 15:10] Improve error handling

Improve UX on API errors.
```

- `## [YYYY-MM-DD HH:MM] Title` — Active request (sent to agents)
- `## [done] [YYYY-MM-DD HH:MM] Title` — Completed request (excluded from agent prompts)

When you run `crew start`, the goal is automatically appended to REQUEST.md with a timestamp. You can manually edit this file at any time to add new requests or mark existing ones as done.

### Task File Format

Tasks are Markdown files with YAML frontmatter, stored in `.crew/tasks/`:

```markdown
---
id: TASK-001
title: "Implement user login"
status: todo
assignee: ""
priority: high
depends_on: []
created_at: "2026-02-25T00:00:00Z"
updated_at: "2026-02-25T00:00:00Z"
stage: "implement"
labels: [backend, auth]
---

# TASK-001: Implement user login

## Description
...

## Acceptance Criteria
- [ ] POST /api/login endpoint
- [ ] JWT token generation
```

### Task Status Flow

```
todo → in_progress → dev_done → in_review → closed
          ↓                        ↓
        blocked              changes_requested
                                   ↓
                              in_progress → ...
```

## Workflow Definition

Workflows are defined in YAML. The built-in `dev-cycle` template:

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

### Workflow Resolution Order

1. Project: `.crew/workflows/` (optional, create manually if needed)
2. User: `~/.crew/workflows/`
3. Built-in: `templates/`

## Configuration

Global config at `~/.crew/config.yaml` (created by `crew init` if absent):

```yaml
defaults:
  planner_model: claude-opus-4-6
  implementer_model: codex-1
  reviewer_model: claude-opus-4-6
tmux:
  session_prefix: crew
agent:
  nudge_interval_seconds: 300  # idle detection interval (override with --nudge-interval)
  max_escalation_phase: 3      # max nudge attempts per stage
  auto_approve: false
workflow:
  poll_interval_seconds: 5
```

The project name is derived from the current directory name (`path.basename(cwd)`).

Set `CREW_HOME` environment variable to override the default `~/.crew` location.

## Architecture

```
src/
├── cli/           # CLI Module (commander.js)
│   ├── commands/  # init, start, status, stop, list, doctor
│   └── config.ts  # ~/.crew/config.yaml read/write
├── workflow/      # Workflow Engine — state machine, YAML parsing
├── runner/        # Agent Runner — tmux management, agent spawn/stop
├── store/         # Task Store — CRUD, status transitions, file watch
├── kernel/        # Shared Kernel — Result<T,E>, types, error codes
└── index.ts       # Entry point
```

### Design Decisions

- **Result\<T, E\>** for all error handling (no throw)
- **Atomic writes** (tmp file → rename) for all file mutations
- **Port pattern** (interface in `types.ts`, implementation separate)
- **Zod validation** at all system boundaries

## Development

```bash
bun install          # Install dependencies
bun run typecheck    # TypeScript strict check
bun run lint         # Biome lint
bun run format       # Biome format
bun test             # Run all tests
bun run dev          # Run CLI in development
```

## Status

**Phase 1 (MVP)** — dev-cycle workflow with 3 agents. Functional but early.

See [status board](./docs/workflow/status.md) for detailed progress.

## License

MIT
