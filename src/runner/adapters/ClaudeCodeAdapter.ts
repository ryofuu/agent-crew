import type { AgentStatus, ModelId } from "../../kernel/index.js";

export interface CliAdapter {
	readonly startCommand: (model: ModelId, cwd: string) => string;
	readonly clearCommand: string;
	detectStatus(paneOutput: string): AgentStatus;
}

export class ClaudeCodeAdapter implements CliAdapter {
	readonly clearCommand = "\x1b\x03"; // Escape + C-c

	startCommand(model: ModelId, cwd: string): string {
		return `cd ${cwd} && claude --model ${model}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		const lines = paneOutput.trim().split("\n");
		const lastLines = lines.slice(-5).join("\n");

		if (lastLines.includes("$") || lastLines.includes("%")) return "idle";
		if (lastLines.includes("Error") || lastLines.includes("error")) return "error";
		return "active";
	}
}
