import type { AgentStatus } from "../../kernel/index.js";
import {
	type CliAdapter,
	detectAgentStatus,
	type StartCommandOptions,
	shellEscape,
} from "./types.js";

export class CodexAdapter implements CliAdapter {
	readonly clearCommand = "\x1b"; // Escape only

	startCommand(
		model: string | undefined,
		cwd: string,
		options?: StartCommandOptions,
	): string {
		const modelFlag = model ? ` --model ${shellEscape(model)}` : "";
		const flags = options?.autoApprove ? " --full-auto" : "";
		return `cd ${shellEscape(cwd)} && codex${modelFlag}${flags}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
