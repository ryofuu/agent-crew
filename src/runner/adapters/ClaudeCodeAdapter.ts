import type { AgentStatus } from "../../kernel/index.js";
import {
	type CliAdapter,
	detectAgentStatus,
	type StartCommandOptions,
	shellEscape,
} from "./types.js";

export class ClaudeCodeAdapter implements CliAdapter {
	readonly clearCommand = "\x1b\x03"; // Escape + C-c

	startCommand(
		model: string | undefined,
		cwd: string,
		options?: StartCommandOptions,
	): string {
		const modelFlag = model ? ` --model ${shellEscape(model)}` : "";
		const flags = options?.autoApprove ? " --dangerously-skip-permissions" : "";
		return `cd ${shellEscape(cwd)} && claude${modelFlag}${flags}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
