import type { AgentStatus, ModelId } from "../../kernel/index.js";
import { type CliAdapter, detectAgentStatus, shellEscape } from "./types.js";

export class ClaudeCodeAdapter implements CliAdapter {
	readonly clearCommand = "\x1b\x03"; // Escape + C-c

	startCommand(model: ModelId, cwd: string): string {
		return `cd ${shellEscape(cwd)} && claude --model ${shellEscape(model)}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
