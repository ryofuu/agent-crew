export type TaskStatus =
	| "todo"
	| "in_progress"
	| "dev_done"
	| "in_review"
	| "blocked"
	| "changes_requested"
	| "closed";

export type WorkflowStatus =
	| "idle"
	| "running"
	| "paused"
	| "completed"
	| "error";

export type AgentStatus = "idle" | "active" | "error" | "stopped";

export type ModelId =
	| "claude-opus-4-6"
	| "claude-sonnet-4-6"
	| "codex-1"
	| "codex-mini-latest"
	| "gpt-5.3-codex";

export type CliType = "claude-code" | "codex";

export type Priority = "critical" | "high" | "medium" | "low";
