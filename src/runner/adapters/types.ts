import type { AgentStatus, ModelId } from "../../kernel/index.js";

export interface StartCommandOptions {
	autoApprove?: boolean;
}

export interface CliAdapter {
	readonly startCommand: (
		model: ModelId,
		cwd: string,
		options?: StartCommandOptions,
	) => string;
	readonly clearCommand: string;
	detectStatus(paneOutput: string): AgentStatus;
}

/**
 * Shell-escape a string for safe inclusion in a shell command.
 * Wraps in single quotes and escapes any embedded single quotes.
 */
export function shellEscape(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Shared status detection logic for CLI adapters.
 * Checks the last 5 lines of tmux pane output.
 */
export function detectAgentStatus(paneOutput: string): AgentStatus {
	const lines = paneOutput.trim().split("\n");
	const lastLines = lines.slice(-5).join("\n");

	// Check for shell prompt (idle) — line ending with prompt char ($, %, #, >)
	if (/[$%#>]\s*$/m.test(lastLines)) return "idle";

	// Check for errors — avoid false positives on "No errors found" etc.
	if (/\b(?:Error|ENOENT|EACCES|fatal|panic)\b/.test(lastLines)) return "error";

	return "active";
}
