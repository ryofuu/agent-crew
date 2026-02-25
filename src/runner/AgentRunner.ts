import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentStatus, CliType, ModelId, Result } from "../kernel/index.js";
import { AgentErrors, err, ok } from "../kernel/index.js";
import { ClaudeCodeAdapter } from "./adapters/ClaudeCodeAdapter.js";
import { CodexAdapter } from "./adapters/CodexAdapter.js";
import type { CliAdapter } from "./adapters/types.js";
import type { TmuxPort } from "./tmux.js";

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CONTEXT_RESET_DELAY_MS = 500;

export interface AgentRunnerPort {
	spawn(
		agentName: string,
		role: string,
		cliType: CliType,
		model: ModelId,
	): Promise<Result<void, string>>;
	stop(agentName: string): Promise<Result<void, string>>;
	stopAll(): Promise<Result<void, string>>;
	sendNudge(agentName: string, message: string): Promise<Result<void, string>>;
	resetContext(agentName: string): Promise<Result<void, string>>;
	getStatus(agentName: string): Promise<Result<AgentStatus, string>>;
	getAllStatuses(): Promise<Result<Record<string, AgentStatus>, string>>;
	isActive(agentName: string): Promise<Result<boolean, string>>;
	createSession(projectName: string): Promise<Result<void, string>>;
	destroySession(): Promise<Result<void, string>>;
	setupLayout(agentCount: number): Promise<Result<void, string>>;
}

interface AgentInfo {
	name: string;
	role: string;
	pane: string;
	adapter: CliAdapter;
	model: ModelId;
}

export class AgentRunner implements AgentRunnerPort {
	private readonly tmux: TmuxPort;
	private readonly crewDir: string;
	private readonly cwd: string;
	private sessionName = "";
	private agents: Map<string, AgentInfo> = new Map();
	private paneIndex = 0;

	constructor(tmux: TmuxPort, crewDir: string, cwd: string) {
		this.tmux = tmux;
		this.crewDir = crewDir;
		this.cwd = cwd;
	}

	private validateAgentName(name: string): Result<void, string> {
		if (!AGENT_NAME_PATTERN.test(name)) {
			return err(`${AgentErrors.AGENT_NOT_FOUND}: invalid agent name: ${name}`);
		}
		return ok(undefined);
	}

	/**
	 * Sanitize a message for safe tmux send-keys.
	 * Strips control characters (except newlines \n and tabs \t).
	 */
	private sanitizeMessage(message: string): string {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally stripping control chars for security
		const ControlChars = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
		return message.replace(ControlChars, "");
	}

	async createSession(projectName: string): Promise<Result<void, string>> {
		this.sessionName = `crew-${projectName}`;
		if (await this.tmux.hasSession(this.sessionName)) {
			return err(AgentErrors.SESSION_EXISTS);
		}
		return this.tmux.newSession(this.sessionName);
	}

	async destroySession(): Promise<Result<void, string>> {
		if (!this.sessionName) return ok(undefined);
		await this.stopAll();
		const result = await this.tmux.killSession(this.sessionName);
		this.sessionName = "";
		this.agents.clear();
		this.paneIndex = 0;
		return result;
	}

	async setupLayout(agentCount: number): Promise<Result<void, string>> {
		if (!this.sessionName) return err(AgentErrors.TMUX_ERROR);

		// Create panes: first pane already exists, split for remaining
		for (let i = 1; i < agentCount; i++) {
			const direction = i === 1 ? "h" : "v";
			const result = await this.tmux.splitWindow(this.sessionName, direction);
			if (!result.ok) return result;
		}

		if (agentCount === 3) {
			return this.tmux.selectLayout(this.sessionName, "tiled");
		}
		return ok(undefined);
	}

	async spawn(
		agentName: string,
		role: string,
		cliType: CliType,
		model: ModelId,
	): Promise<Result<void, string>> {
		const nameCheck = this.validateAgentName(agentName);
		if (!nameCheck.ok) return nameCheck;

		if (this.agents.has(agentName)) {
			return err(
				`${AgentErrors.SPAWN_FAILED}: agent ${agentName} already exists`,
			);
		}

		const adapter: CliAdapter =
			cliType === "claude-code" ? new ClaudeCodeAdapter() : new CodexAdapter();
		const pane = `${this.sessionName}:0.${this.paneIndex}`;
		const command = adapter.startCommand(model, this.cwd);

		const result = await this.tmux.sendText(pane, command);
		if (!result.ok) return result;

		this.agents.set(agentName, { name: agentName, role, pane, adapter, model });
		this.paneIndex++;
		return ok(undefined);
	}

	async stop(agentName: string): Promise<Result<void, string>> {
		const agent = this.agents.get(agentName);
		if (!agent) return err(`${AgentErrors.AGENT_NOT_FOUND}: ${agentName}`);

		await this.tmux.sendKeys(agent.pane, "C-c");
		this.agents.delete(agentName);
		return ok(undefined);
	}

	async stopAll(): Promise<Result<void, string>> {
		for (const [name] of this.agents) {
			await this.stop(name);
		}
		return ok(undefined);
	}

	async sendNudge(
		agentName: string,
		message: string,
	): Promise<Result<void, string>> {
		const agent = this.agents.get(agentName);
		if (!agent) return err(`${AgentErrors.AGENT_NOT_FOUND}: ${agentName}`);

		const sanitized = this.sanitizeMessage(message);
		return await this.tmux.sendText(agent.pane, sanitized);
	}

	async resetContext(agentName: string): Promise<Result<void, string>> {
		const agent = this.agents.get(agentName);
		if (!agent) return err(`${AgentErrors.AGENT_NOT_FOUND}: ${agentName}`);

		// Send clear command (Escape + C-c for Claude, Escape for Codex)
		const clearResult = await this.tmux.sendKeys(
			agent.pane,
			agent.adapter.clearCommand,
		);
		if (!clearResult.ok) return clearResult;

		await Bun.sleep(CONTEXT_RESET_DELAY_MS);

		// Restart the agent
		const command = agent.adapter.startCommand(agent.model, this.cwd);
		return this.tmux.sendText(agent.pane, command);
	}

	async getStatus(agentName: string): Promise<Result<AgentStatus, string>> {
		const agent = this.agents.get(agentName);
		if (!agent) return err(`${AgentErrors.AGENT_NOT_FOUND}: ${agentName}`);

		const output = await this.tmux.capturePane(agent.pane);
		if (!output.ok) return output;

		return ok(agent.adapter.detectStatus(output.value));
	}

	async getAllStatuses(): Promise<Result<Record<string, AgentStatus>, string>> {
		const statuses: Record<string, AgentStatus> = {};
		for (const [name, agent] of this.agents) {
			const output = await this.tmux.capturePane(agent.pane);
			if (output.ok) {
				statuses[name] = agent.adapter.detectStatus(output.value);
			} else {
				statuses[name] = "error";
			}
		}
		return ok(statuses);
	}

	async isActive(agentName: string): Promise<Result<boolean, string>> {
		const status = await this.getStatus(agentName);
		if (!status.ok) return status;
		return ok(status.value === "active");
	}

	async writeInbox(
		agentName: string,
		content: string,
	): Promise<Result<void, string>> {
		const nameCheck = this.validateAgentName(agentName);
		if (!nameCheck.ok) return nameCheck;

		const inboxDir = path.join(this.crewDir, "inbox");
		await fs.promises.mkdir(inboxDir, { recursive: true });
		const inboxPath = path.join(inboxDir, `${agentName}.md`);
		const tmpPath = `${inboxPath}.tmp`;
		try {
			// Read existing content, append, then atomic write
			let existing = "";
			try {
				existing = await fs.promises.readFile(inboxPath, "utf-8");
			} catch {
				// File doesn't exist yet
			}
			await fs.promises.writeFile(tmpPath, `${existing}${content}\n`, "utf-8");
			await fs.promises.rename(tmpPath, inboxPath);
			return ok(undefined);
		} catch (e) {
			return err(`${AgentErrors.NUDGE_FAILED}: ${e}`);
		}
	}

	getSessionName(): string {
		return this.sessionName;
	}

	setSessionName(name: string): void {
		this.sessionName = name;
	}
}
