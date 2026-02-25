import type { AgentStatus, ModelId } from "../../kernel/index.js";
import { type CliAdapter, detectAgentStatus, shellEscape } from "./types.js";

export class CodexAdapter implements CliAdapter {
	readonly clearCommand = "\x1b"; // Escape only

	startCommand(model: ModelId, cwd: string): string {
		return `cd ${shellEscape(cwd)} && codex --model ${shellEscape(model)}`;
	}

	detectStatus(paneOutput: string): AgentStatus {
		return detectAgentStatus(paneOutput);
	}
}
