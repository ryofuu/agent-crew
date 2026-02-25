import type { AgentStatus, ModelId } from "../../kernel/index.js";
import {
	type CliAdapter,
	detectAgentStatus,
	type StartCommandOptions,
	shellEscape,
} from "./types.js";

export class ClaudeCodeAdapter implements CliAdapter {
	readonly clearCommand = "\x1b\x03"; // Escape + C-c

	startCommand(
		model: ModelId,
		cwd: string,
		options?: StartCommandOptions,
	): string {
		const flags = options?.autoApprove ? " --dangerously-skip-permissions" : "";
		return `cd ${shellEscape(cwd)} && claude --model ${shellEscape(model)}${flags}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
