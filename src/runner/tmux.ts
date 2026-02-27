import type { Result } from "../kernel/index.js";
import { AgentErrors, err, ok } from "../kernel/index.js";

export interface TmuxPort {
	run(args: string[]): Promise<Result<string, string>>;
	hasSession(name: string): Promise<boolean>;
	newSession(name: string): Promise<Result<void, string>>;
	killSession(name: string): Promise<Result<void, string>>;
	splitWindow(
		session: string,
		direction: "h" | "v",
	): Promise<Result<void, string>>;
	sendKeys(target: string, keys: string): Promise<Result<void, string>>;
	sendText(target: string, text: string): Promise<Result<void, string>>;
	sendPromptFile(
		target: string,
		filePath: string,
	): Promise<Result<void, string>>;
	capturePane(target: string): Promise<Result<string, string>>;
	selectLayout(session: string, layout: string): Promise<Result<void, string>>;
	getPanePid(target: string): Promise<Result<number, string>>;
}

export class Tmux implements TmuxPort {
	async run(args: string[]): Promise<Result<string, string>> {
		try {
			const proc = Bun.spawn(["tmux", ...args], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdout = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;
			if (exitCode !== 0) {
				const stderr = await new Response(proc.stderr).text();
				return err(`${AgentErrors.TMUX_ERROR}: ${stderr.trim()}`);
			}
			return ok(stdout.trim());
		} catch (e) {
			return err(`${AgentErrors.TMUX_ERROR}: ${e}`);
		}
	}

	async hasSession(name: string): Promise<boolean> {
		const result = await this.run(["has-session", "-t", name]);
		return result.ok;
	}

	async newSession(name: string): Promise<Result<void, string>> {
		const result = await this.run(["new-session", "-d", "-s", name]);
		if (!result.ok) return result;
		return ok(undefined);
	}

	async killSession(name: string): Promise<Result<void, string>> {
		const result = await this.run(["kill-session", "-t", name]);
		if (!result.ok) return result;
		return ok(undefined);
	}

	async splitWindow(
		session: string,
		direction: "h" | "v",
	): Promise<Result<void, string>> {
		const flag = direction === "h" ? "-h" : "-v";
		const result = await this.run(["split-window", flag, "-t", session]);
		if (!result.ok) return result;
		return ok(undefined);
	}

	async sendKeys(target: string, keys: string): Promise<Result<void, string>> {
		const result = await this.run(["send-keys", "-t", target, keys]);
		if (!result.ok) return result;
		return ok(undefined);
	}

	async sendText(target: string, text: string): Promise<Result<void, string>> {
		// Codex TUI limitation: send text, sleep 0.3s, then Enter
		const textResult = await this.sendKeys(target, text);
		if (!textResult.ok) return textResult;

		await Bun.sleep(300);

		return this.sendKeys(target, "Enter");
	}

	async sendPromptFile(
		target: string,
		filePath: string,
	): Promise<Result<void, string>> {
		const loadResult = await this.run(["load-buffer", filePath]);
		if (!loadResult.ok) return loadResult;

		const pasteResult = await this.run(["paste-buffer", "-p", "-t", target]);
		if (!pasteResult.ok) return pasteResult;

		await Bun.sleep(300);
		return this.sendKeys(target, "Enter");
	}

	async capturePane(target: string): Promise<Result<string, string>> {
		return await this.run(["capture-pane", "-t", target, "-p"]);
	}

	async selectLayout(
		session: string,
		layout: string,
	): Promise<Result<void, string>> {
		const result = await this.run(["select-layout", "-t", session, layout]);
		if (!result.ok) return result;
		return ok(undefined);
	}

	async getPanePid(target: string): Promise<Result<number, string>> {
		const result = await this.run([
			"display-message",
			"-t",
			target,
			"-p",
			"#{pane_pid}",
		]);
		if (!result.ok) return result;
		const pid = Number.parseInt(result.value, 10);
		if (Number.isNaN(pid)) {
			return err(
				`${AgentErrors.TMUX_ERROR}: invalid pane pid: ${result.value}`,
			);
		}
		return ok(pid);
	}
}
