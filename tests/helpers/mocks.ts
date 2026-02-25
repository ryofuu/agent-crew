import { ok } from "../../src/kernel/result.js";
import type { TmuxPort } from "../../src/runner/tmux.js";

export function createMockTmux(): TmuxPort {
	return {
		run: () => Promise.resolve(ok("")),
		hasSession: () => Promise.resolve(false),
		newSession: () => Promise.resolve(ok(undefined)),
		killSession: () => Promise.resolve(ok(undefined)),
		splitWindow: () => Promise.resolve(ok(undefined)),
		sendKeys: () => Promise.resolve(ok(undefined)),
		sendText: () => Promise.resolve(ok(undefined)),
		sendPromptFile: () => Promise.resolve(ok(undefined)),
		capturePane: () => Promise.resolve(ok("")),
		selectLayout: () => Promise.resolve(ok(undefined)),
	};
}
