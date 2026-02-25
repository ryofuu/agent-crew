import type { AgentStatus, ModelId } from "../../kernel/index.js";
import {
	type CliAdapter,
	detectAgentStatus,
	type StartCommandOptions,
	shellEscape,
} from "./types.js";

export class CodexAdapter implements CliAdapter {
	readonly clearCommand = "\x1b"; // Escape only

	startCommand(
		model: ModelId,
		cwd: string,
		options?: StartCommandOptions,
	): string {
		const flags = options?.autoApprove ? " --full-auto" : "";
		return `cd ${shellEscape(cwd)} && codex --model ${shellEscape(model)}${flags}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
