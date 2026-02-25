import type { AgentStatus, ModelId } from "../../kernel/index.js";
import type { CliAdapter } from "./ClaudeCodeAdapter.js";

export class CodexAdapter implements CliAdapter {
	readonly clearCommand = "\x1b"; // Escape only

	startCommand(model: ModelId, cwd: string): string {
		return `cd ${cwd} && codex --model ${model}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		const lines = paneOutput.trim().split("\n");
		const lastLines = lines.slice(-5).join("\n");

		if (lastLines.includes("$") || lastLines.includes("%")) return "idle";
		if (lastLines.includes("Error") || lastLines.includes("error")) return "error";
		return "active";
	}
}
