import * as fs from "node:fs";
import * as path from "node:path";
import type { CliType } from "../../kernel/index.js";
import type { AgentRunnerPort } from "../../runner/index.js";
import type {
	StageDefinition,
	WorkflowEnginePort,
} from "../../workflow/index.js";
import {
	formatNewEntry,
	getActiveGoal,
	parseRequest,
	readState,
} from "../../workflow/index.js";

export const AGENT_READY_TIMEOUT_MS = 15_000;
export const RESPAWN_READY_TIMEOUT_MS = 15_000;
export const NUDGE_MESSAGE =
	"タスクを続行してください。止まっている場合はシグナルファイルを作成してください。";

// --- ログユーティリティ ---

/** .crew/logs/ にタイムスタンプ付きでログを書き出す */
export class CrewLogger {
	private stream: fs.WriteStream | null = null;
	private logPath: string;

	constructor(crewDir: string) {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		this.logPath = path.join(crewDir, "logs", `crew-${timestamp}.log`);
	}

	/** ログファイルを開く */
	async open(): Promise<void> {
		const dir = path.dirname(this.logPath);
		await fs.promises.mkdir(dir, { recursive: true });
		this.stream = fs.createWriteStream(this.logPath, { flags: "a" });
	}

	/** ログ出力（ファイル + stdout） */
	log(message: string): void {
		const line = `[${new Date().toISOString()}] ${message}`;
		console.log(message);
		this.stream?.write(`${line}\n`);
	}

	/** エラー出力（ファイル + stderr） */
	error(message: string): void {
		const line = `[${new Date().toISOString()}] ERROR: ${message}`;
		console.error(message);
		this.stream?.write(`${line}\n`);
	}

	/** ログファイルを閉じる */
	close(): void {
		this.stream?.end();
		this.stream = null;
	}

	getPath(): string {
		return this.logPath;
	}
}

export interface AgentEntry {
	name: string;
	role: string;
	cliType: CliType;
	model: string | undefined;
}

export function buildAgentList(stages: StageDefinition[]): AgentEntry[] {
	return stages.map((stage) => ({
		name: stage.role,
		role: stage.role,
		cliType: stage.provider as CliType,
		model: stage.model,
	}));
}

export async function loadRoleTemplate(role: string): Promise<string> {
	const templatePath = path.join(
		import.meta.dir,
		`../../../templates/agents/${role}.md`,
	);
	try {
		return await fs.promises.readFile(templatePath, "utf-8");
	} catch {
		return `You are the ${role}.`;
	}
}

export async function loadContext(crewDir: string): Promise<string> {
	const contextPath = path.join(crewDir, "CONTEXT.md");
	try {
		return await fs.promises.readFile(contextPath, "utf-8");
	} catch {
		return "";
	}
}

/** ワークフロー定義YAMLを読み込む（エージェントに全体像を伝えるため） */
export async function loadWorkflowYaml(workflowName: string): Promise<string> {
	const templatePath = path.join(
		import.meta.dir,
		`../../../templates/${workflowName}.yaml`,
	);
	try {
		return await fs.promises.readFile(templatePath, "utf-8");
	} catch {
		return "";
	}
}

export async function loadActiveGoal(crewDir: string): Promise<string> {
	const requestPath = path.join(crewDir, "REQUEST.md");
	try {
		const content = await fs.promises.readFile(requestPath, "utf-8");
		const entries = parseRequest(content);
		const goal = getActiveGoal(entries);
		if (goal) return goal;
	} catch {
		// REQUEST.md not found — fall through to state.json
	}
	const stateResult = await readState(crewDir);
	if (stateResult.ok) return stateResult.value.goal;
	return "";
}

export async function writeRequestEntry(
	crewDir: string,
	title: string,
	body: string,
): Promise<void> {
	const requestPath = path.join(crewDir, "REQUEST.md");
	const entry = formatNewEntry(title, body);
	let existing = "";
	try {
		existing = await fs.promises.readFile(requestPath, "utf-8");
	} catch {
		// file doesn't exist yet
	}
	const content = existing
		? `${existing.trimEnd()}\n\n${entry}\n`
		: `# Request\n\n${entry}\n`;
	const tmpPath = `${requestPath}.tmp`;
	await fs.promises.writeFile(tmpPath, content, "utf-8");
	await fs.promises.rename(tmpPath, requestPath);
}

export function buildPrompt(
	roleTemplate: string,
	goal: string,
	role: string,
	workflowName: string,
	context: string,
	workflowYaml: string,
): string {
	const contextSection = context ? `\n## Shared Context\n\n${context}\n` : "";
	const workflowSection = workflowYaml
		? `\n## Workflow\n\nあなたは以下のワークフローの中で実行されています。あなたの役割は "${role}" ステージです。\n\n\`\`\`yaml\n${workflowYaml}\`\`\`\n`
		: `\n## Workflow\n\nWorkflow: ${workflowName}\n`;
	return `${roleTemplate}
${contextSection}
## Goal

${goal}
${workflowSection}
Tasks directory: .crew/tasks/

上記の指示とゴールに従って作業を開始してください。`;
}

export async function handleGate(engine: WorkflowEnginePort): Promise<boolean> {
	const stageResult = await engine.getCurrentStage();
	if (!stageResult.ok || stageResult.value?.status !== "waiting_gate") {
		return true;
	}

	const stageName = stageResult.value.name;
	console.log(`\nGate: '${stageName}' stage requires approval.`);
	const answer = prompt("Approve? [y/N]: ");
	if (answer?.toLowerCase() === "y") {
		await engine.approveGate();
		console.log("Gate approved.");
		return true;
	}

	await engine.rejectGate();
	console.log("Gate rejected. Workflow stopped.");
	return false;
}

export async function promptAgent(
	runner: AgentRunnerPort,
	agentName: string,
	role: string,
	workflowName: string,
	contextReset: boolean,
	crewDir: string,
): Promise<void> {
	if (contextReset) {
		console.log(`Resetting context for '${agentName}'...`);
		const resetResult = await runner.resetContext(agentName);
		if (!resetResult.ok) {
			console.error(
				`Error resetting context for ${agentName}: ${resetResult.error}`,
			);
		}
	}
	const roleTemplate = await loadRoleTemplate(role);
	const context = await loadContext(crewDir);
	const goal = await loadActiveGoal(crewDir);
	const workflowYaml = await loadWorkflowYaml(workflowName);
	const builtPrompt = buildPrompt(
		roleTemplate,
		goal,
		role,
		workflowName,
		context,
		workflowYaml,
	);
	await runner.waitForReady(agentName, AGENT_READY_TIMEOUT_MS);
	const result = await runner.sendInitialPrompt(agentName, builtPrompt);
	if (!result.ok) {
		console.error(`Error sending prompt to ${agentName}: ${result.error}`);
	}
}

// --- Signal file helpers ---

function signalPath(crewDir: string, role: string): string {
	return path.join(crewDir, "signals", `${role}.done`);
}

interface SignalPayload {
	result: string;
	tasks?: string[];
}

export async function readSignal(
	crewDir: string,
	role: string,
): Promise<SignalPayload | null> {
	try {
		const raw = await fs.promises.readFile(signalPath(crewDir, role), "utf-8");
		return JSON.parse(raw) as SignalPayload;
	} catch {
		return null;
	}
}

export async function removeSignal(
	crewDir: string,
	role: string,
): Promise<void> {
	try {
		await fs.promises.unlink(signalPath(crewDir, role));
	} catch {
		// already removed or never existed
	}
}

/** signals ディレクトリを作成し、前回の残存シグナルをすべて削除する */
export async function cleanSignalsDir(crewDir: string): Promise<void> {
	const dir = path.join(crewDir, "signals");
	await fs.promises.mkdir(dir, { recursive: true });
	try {
		const files = await fs.promises.readdir(dir);
		for (const file of files) {
			await fs.promises.unlink(path.join(dir, file));
		}
	} catch {
		// empty or inaccessible
	}
}

// --- Poll loop ---

export interface PollContext {
	logger: CrewLogger;
	engine: WorkflowEnginePort;
	runner: AgentRunnerPort;
	crewDir: string;
	stages: StageDefinition[];
	workflowName: string;
	promptedStageIndex: number;
	nudgeIntervalMs: number;
	maxNudges: number;
	maxRespawns: number;
	lastActiveAt: number;
	nudgeCount: number;
}

/** Returns "break" to exit loop, "continue" to keep polling. */
export async function tryAdvanceStage(
	ctx: PollContext,
): Promise<"break" | "continue"> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok) return "break";
	const state = stateResult.value;

	const currentStage = state.stages[state.currentStageIndex];
	const stageDef = ctx.stages[state.currentStageIndex];
	if (currentStage?.status !== "active" || !stageDef) return "continue";

	// Check for signal file: .crew/signals/{role}.done
	const signal = await readSignal(ctx.crewDir, stageDef.role);
	if (!signal) return "continue";

	// Signal detected — clean up and advance
	await removeSignal(ctx.crewDir, stageDef.role);
	ctx.logger.log(
		`Stage '${currentStage.name}' completed (signal received). Advancing...`,
	);
	if (signal.tasks && signal.tasks.length > 0) {
		ctx.logger.log(`  Tasks: ${signal.tasks.join(", ")}`);
	}

	const advResult = await ctx.engine.advance();
	if (!advResult.ok) {
		ctx.logger.error(`Error advancing: ${advResult.error}`);
		return "break";
	}

	// Prompt next stage's agent if newly active
	const newState = await ctx.engine.getState();
	if (!newState.ok || newState.value.status !== "running") return "continue";

	const nextIdx = newState.value.currentStageIndex;
	// Detect loop: stage index went backwards → reset prompt tracking
	if (nextIdx < state.currentStageIndex) {
		ctx.logger.log(
			`Loop detected: stage ${state.currentStageIndex} → ${nextIdx}. Resetting prompt tracking.`,
		);
		ctx.promptedStageIndex = -1;
	}
	const nextStage = newState.value.stages[nextIdx];
	const nextDef = ctx.stages[nextIdx];
	if (nextStage?.status === "active" && nextDef) {
		ctx.logger.log(
			`Prompting '${nextDef.role}' for stage '${nextStage.name}'...`,
		);
		await promptAgent(
			ctx.runner,
			nextDef.role,
			nextDef.role,
			ctx.workflowName,
			nextDef.context_reset,
			ctx.crewDir,
		);
		ctx.promptedStageIndex = nextIdx;
	}
	return "continue";
}

/** Prompt the current stage's agent if it became active (e.g. after gate approval) and hasn't been prompted yet. */
export async function promptIfNeeded(ctx: PollContext): Promise<void> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok || stateResult.value.status !== "running") return;

	const idx = stateResult.value.currentStageIndex;
	const stage = stateResult.value.stages[idx];
	const def = ctx.stages[idx];
	if (stage?.status === "active" && def && idx > ctx.promptedStageIndex) {
		ctx.logger.log(
			`Prompting '${def.role}' for stage '${stage.name}' (promptIfNeeded)...`,
		);
		await promptAgent(
			ctx.runner,
			def.role,
			def.role,
			ctx.workflowName,
			def.context_reset,
			ctx.crewDir,
		);
		ctx.promptedStageIndex = idx;
	}
}

export async function maybeNudgeAgent(ctx: PollContext): Promise<void> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok || stateResult.value.status !== "running") return;

	const idx = stateResult.value.currentStageIndex;
	const currentStage = stateResult.value.stages[idx];
	const stageDef = ctx.stages[idx];
	if (currentStage?.status !== "active" || !stageDef) return;

	const statusResult = await ctx.runner.getStatus(stageDef.role);
	if (!statusResult.ok) return;

	const now = Date.now();
	if (statusResult.value === "active") {
		ctx.lastActiveAt = now;
		ctx.nudgeCount = 0;
		return;
	}

	if (
		statusResult.value === "idle" &&
		now - ctx.lastActiveAt > ctx.nudgeIntervalMs &&
		ctx.nudgeCount < ctx.maxNudges
	) {
		ctx.nudgeCount++;
		ctx.logger.log(
			`Nudging '${stageDef.role}' (attempt ${ctx.nudgeCount}/${ctx.maxNudges})...`,
		);
		await ctx.runner.sendNudge(stageDef.role, NUDGE_MESSAGE);
		ctx.lastActiveAt = now;
	}
}

export async function maybeRecoverAgent(ctx: PollContext): Promise<void> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok || stateResult.value.status !== "running") return;

	const idx = stateResult.value.currentStageIndex;
	const stageDef = ctx.stages[idx];
	if (!stageDef) return;

	const healthResult = await ctx.runner.checkHealth(stageDef.role);
	if (!healthResult.ok || healthResult.value !== "dead") return;

	const agentInfo = ctx.runner.getAgentInfo(stageDef.role);
	if (agentInfo && agentInfo.respawnCount >= ctx.maxRespawns) {
		ctx.logger.error(
			`Agent '${stageDef.role}' died but max respawns (${ctx.maxRespawns}) reached. Giving up.`,
		);
		return;
	}

	ctx.logger.log(`Agent '${stageDef.role}' detected dead. Respawning...`);
	const respawnResult = await ctx.runner.respawn(stageDef.role);
	if (!respawnResult.ok) {
		ctx.logger.error(
			`Respawn failed for '${stageDef.role}': ${respawnResult.error}`,
		);
		return;
	}

	await ctx.runner.waitForReady(stageDef.role, RESPAWN_READY_TIMEOUT_MS);
	await ctx.runner.recordPid(stageDef.role);
	await ctx.runner.persistRegistry();

	// Re-send current stage prompt
	await promptAgent(
		ctx.runner,
		stageDef.role,
		stageDef.role,
		ctx.workflowName,
		stageDef.context_reset,
		ctx.crewDir,
	);

	// Reset nudge counter
	ctx.lastActiveAt = Date.now();
	ctx.nudgeCount = 0;
	ctx.logger.log(`Agent '${stageDef.role}' respawned and prompted.`);
}

export async function pollLoop(
	logger: CrewLogger,
	engine: WorkflowEnginePort,
	runner: AgentRunnerPort,
	crewDir: string,
	stages: StageDefinition[],
	workflowName: string,
	promptedStageIndex: number,
	pollInterval: number,
	nudgeIntervalMs: number,
	maxNudges: number,
	maxRespawns: number,
	signal: AbortSignal,
): Promise<void> {
	const ctx: PollContext = {
		logger,
		engine,
		runner,
		crewDir,
		stages,
		workflowName,
		promptedStageIndex,
		nudgeIntervalMs,
		maxNudges,
		maxRespawns,
		lastActiveAt: Date.now(),
		nudgeCount: 0,
	};

	while (!signal.aborted) {
		const stateResult = await engine.getState();
		if (!stateResult.ok) break;

		const { status } = stateResult.value;
		if (status === "completed") {
			logger.log("Workflow completed.");
			break;
		}
		if (status === "error") {
			logger.error("Workflow error.");
			break;
		}

		const shouldContinue = await handleGate(engine);
		if (!shouldContinue) break;

		// After gate approval, prompt the agent if the stage is newly active
		await promptIfNeeded(ctx);

		const action = await tryAdvanceStage(ctx);
		if (action === "break") break;

		await maybeRecoverAgent(ctx);
		await maybeNudgeAgent(ctx);

		await Bun.sleep(pollInterval);
	}
}

export interface RunOptions {
	autoApprove?: boolean;
	nudgeInterval?: number;
	keepSession?: boolean;
}

export async function spawnAgents(
	runner: AgentRunnerPort,
	agents: AgentEntry[],
	autoApprove: boolean,
): Promise<void> {
	if (autoApprove) {
		console.log("Auto-approve mode enabled.");
	}
	const spawnOptions = autoApprove ? { autoApprove: true } : undefined;
	for (const agent of agents) {
		const result = await runner.spawn(
			agent.name,
			agent.role,
			agent.cliType,
			agent.model,
			spawnOptions,
		);
		if (!result.ok) {
			console.error(`Error spawning ${agent.name}: ${result.error}`);
		}
	}
}

export async function recordAllPids(
	runner: AgentRunnerPort,
	agents: AgentEntry[],
): Promise<void> {
	for (const agent of agents) {
		await runner.recordPid(agent.name);
	}
	await runner.persistRegistry();
}

export async function sendFirstPrompt(
	engine: WorkflowEnginePort,
	runner: AgentRunnerPort,
	stageDefs: StageDefinition[],
	workflowName: string,
	crewDir: string,
): Promise<number> {
	const stateResult = await engine.getState();
	if (!stateResult.ok) return -1;

	const idx = stateResult.value.currentStageIndex;
	const stage = stateResult.value.stages[idx];
	const def = stageDefs[idx];
	if (stage?.status === "active" && def) {
		console.log(`Sending initial prompt to '${def.role}'...`);
		await promptAgent(
			runner,
			def.role,
			def.role,
			workflowName,
			def.context_reset,
			crewDir,
		);
		return idx;
	}
	return -1;
}
