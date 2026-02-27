import * as fs from "node:fs";
import * as path from "node:path";
import type { CliType } from "../../kernel/index.js";
import type { AgentRunnerPort } from "../../runner/index.js";
import { AgentRunner, Tmux } from "../../runner/index.js";
import type {
	StageDefinition,
	WorkflowEnginePort,
} from "../../workflow/index.js";
import {
	formatNewEntry,
	getActiveGoal,
	parseRequest,
	readState,
	WorkflowEngine,
} from "../../workflow/index.js";
import { readConfig } from "../config.js";

const AGENT_READY_TIMEOUT_MS = 15_000;

interface AgentEntry {
	name: string;
	role: string;
	cliType: CliType;
	model: string | undefined;
}

function buildAgentList(stages: StageDefinition[]): AgentEntry[] {
	return stages.map((stage) => ({
		name: stage.role,
		role: stage.role,
		cliType: stage.provider as CliType,
		model: stage.model,
	}));
}

async function loadRoleTemplate(role: string): Promise<string> {
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

async function loadContext(crewDir: string): Promise<string> {
	const contextPath = path.join(crewDir, "CONTEXT.md");
	try {
		return await fs.promises.readFile(contextPath, "utf-8");
	} catch {
		return "";
	}
}

async function loadActiveGoal(crewDir: string): Promise<string> {
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

async function writeRequestEntry(
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

function buildPrompt(
	roleTemplate: string,
	goal: string,
	workflowName: string,
	context: string,
): string {
	const contextSection = context ? `\n## Shared Context\n\n${context}\n` : "";
	return `${roleTemplate}
${contextSection}
## Goal

${goal}

## Workflow

Workflow: ${workflowName}
Tasks directory: .crew/tasks/

上記の指示とゴールに従って作業を開始してください。`;
}

async function handleGate(engine: WorkflowEnginePort): Promise<boolean> {
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

async function promptAgent(
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
	const builtPrompt = buildPrompt(roleTemplate, goal, workflowName, context);
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

async function readSignal(
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

async function removeSignal(crewDir: string, role: string): Promise<void> {
	try {
		await fs.promises.unlink(signalPath(crewDir, role));
	} catch {
		// already removed or never existed
	}
}

async function ensureSignalsDir(crewDir: string): Promise<void> {
	await fs.promises.mkdir(path.join(crewDir, "signals"), { recursive: true });
}

// --- Poll loop ---

interface PollContext {
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
async function tryAdvanceStage(
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
	console.log(
		`Stage '${currentStage.name}' completed (signal received). Advancing...`,
	);
	if (signal.tasks && signal.tasks.length > 0) {
		console.log(`  Tasks: ${signal.tasks.join(", ")}`);
	}

	const advResult = await ctx.engine.advance();
	if (!advResult.ok) {
		console.error(`Error advancing: ${advResult.error}`);
		return "break";
	}

	// Prompt next stage's agent if newly active
	const newState = await ctx.engine.getState();
	if (!newState.ok || newState.value.status !== "running") return "continue";

	const nextIdx = newState.value.currentStageIndex;
	// Detect loop: stage index went backwards → reset prompt tracking
	if (nextIdx < state.currentStageIndex) {
		ctx.promptedStageIndex = -1;
	}
	const nextStage = newState.value.stages[nextIdx];
	const nextDef = ctx.stages[nextIdx];
	if (nextStage?.status === "active" && nextDef) {
		console.log(`Prompting '${nextDef.role}' for stage '${nextStage.name}'...`);
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
async function promptIfNeeded(ctx: PollContext): Promise<void> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok || stateResult.value.status !== "running") return;

	const idx = stateResult.value.currentStageIndex;
	const stage = stateResult.value.stages[idx];
	const def = ctx.stages[idx];
	if (stage?.status === "active" && def && idx > ctx.promptedStageIndex) {
		console.log(`Prompting '${def.role}' for stage '${stage.name}'...`);
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

const NUDGE_MESSAGE =
	"タスクを続行してください。止まっている場合はシグナルファイルを作成してください。";

async function maybeNudgeAgent(ctx: PollContext): Promise<void> {
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
		console.log(
			`Nudging '${stageDef.role}' (attempt ${ctx.nudgeCount}/${ctx.maxNudges})...`,
		);
		await ctx.runner.sendNudge(stageDef.role, NUDGE_MESSAGE);
		ctx.lastActiveAt = now;
	}
}

const RESPAWN_READY_TIMEOUT_MS = 15_000;

async function maybeRecoverAgent(ctx: PollContext): Promise<void> {
	const stateResult = await ctx.engine.getState();
	if (!stateResult.ok || stateResult.value.status !== "running") return;

	const idx = stateResult.value.currentStageIndex;
	const stageDef = ctx.stages[idx];
	if (!stageDef) return;

	const healthResult = await ctx.runner.checkHealth(stageDef.role);
	if (!healthResult.ok || healthResult.value !== "dead") return;

	const agentInfo = ctx.runner.getAgentInfo(stageDef.role);
	if (agentInfo && agentInfo.respawnCount >= ctx.maxRespawns) {
		console.error(
			`Agent '${stageDef.role}' died but max respawns (${ctx.maxRespawns}) reached. Giving up.`,
		);
		return;
	}

	console.log(`Agent '${stageDef.role}' detected dead. Respawning...`);
	const respawnResult = await ctx.runner.respawn(stageDef.role);
	if (!respawnResult.ok) {
		console.error(
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
	console.log(`Agent '${stageDef.role}' respawned and prompted.`);
}

async function pollLoop(
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
			console.log("Workflow completed.");
			break;
		}
		if (status === "error") {
			console.error("Workflow error.");
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

interface StartOptions {
	autoApprove?: boolean;
	nudgeInterval?: number;
	keepSession?: boolean;
}

async function spawnAgents(
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

async function recordAllPids(
	runner: AgentRunnerPort,
	agents: AgentEntry[],
): Promise<void> {
	for (const agent of agents) {
		await runner.recordPid(agent.name);
	}
	await runner.persistRegistry();
}

async function sendFirstPrompt(
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

export async function startCommand(
	workflowName: string,
	goal: string,
	options?: StartOptions,
): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const configResult = await readConfig();
	if (!configResult.ok) {
		console.error(`Error: ${configResult.error}`);
		console.error("Run 'crew init' first.");
		process.exit(1);
	}
	const config = configResult.value;
	const projectName = path.basename(cwd);

	const engine = new WorkflowEngine(crewDir);
	const tmux = new Tmux();
	const runner = new AgentRunner(tmux, crewDir, cwd);

	const startResult = await engine.start(workflowName, goal);
	if (!startResult.ok) {
		console.error(`Error: ${startResult.error}`);
		process.exit(1);
	}

	// Write goal to REQUEST.md
	await writeRequestEntry(crewDir, goal, "");

	const stageDefsResult = await engine.getStageDefinitions();
	if (!stageDefsResult.ok) {
		console.error(`Error: ${stageDefsResult.error}`);
		process.exit(1);
	}
	const stageDefs = stageDefsResult.value;
	const agents = buildAgentList(stageDefs);

	const sessionResult = await runner.createSession(projectName);
	if (!sessionResult.ok) {
		console.error(`Error: ${sessionResult.error}`);
		process.exit(1);
	}

	await ensureSignalsDir(crewDir);
	await runner.setupLayout(agents.length);

	const autoApprove = options?.autoApprove || config.agent.auto_approve;
	await spawnAgents(runner, agents, autoApprove);

	// Wait briefly for CLIs to start, then record PIDs
	await Bun.sleep(2000);
	await recordAllPids(runner, agents);

	console.log(`Workflow '${workflowName}' started with goal: "${goal}"`);
	console.log(`tmux session: crew-${projectName}`);

	const promptedStageIndex = await sendFirstPrompt(
		engine,
		runner,
		stageDefs,
		workflowName,
		crewDir,
	);

	const abortController = new AbortController();
	const cleanup = async () => {
		console.log("\nShutting down...");
		abortController.abort();
		await runner.destroySession();
		await engine.stop();
		process.exit(0);
	};
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);

	const pollInterval = config.workflow.poll_interval_seconds * 1000;
	const nudgeIntervalSeconds =
		options?.nudgeInterval ?? config.agent.nudge_interval_seconds;
	const nudgeIntervalMs = nudgeIntervalSeconds * 1000;
	const maxNudges = config.agent.max_escalation_phase;
	const maxRespawns = config.agent.max_respawns;
	await pollLoop(
		engine,
		runner,
		crewDir,
		stageDefs,
		workflowName,
		promptedStageIndex,
		pollInterval,
		nudgeIntervalMs,
		maxNudges,
		maxRespawns,
		abortController.signal,
	);

	const keepSession = options?.keepSession || config.tmux.keep_session;
	if (keepSession) {
		console.log(
			`Workflow completed. tmux session kept alive: ${runner.getSessionName()}`,
		);
		console.log("Run 'crew stop' to remove the session.");
	} else {
		await runner.destroySession();
	}
}
