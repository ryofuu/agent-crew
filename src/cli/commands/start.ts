import * as fs from "node:fs";
import * as path from "node:path";
import type { CliType } from "../../kernel/index.js";
import type { AgentRunnerPort } from "../../runner/index.js";
import { AgentRunner, Tmux } from "../../runner/index.js";
import type {
	StageDefinition,
	WorkflowEnginePort,
} from "../../workflow/index.js";
import { WorkflowEngine } from "../../workflow/index.js";
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

function buildPrompt(
	roleTemplate: string,
	goal: string,
	workflowName: string,
): string {
	return `${roleTemplate}

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
	goal: string,
	workflowName: string,
): Promise<void> {
	const roleTemplate = await loadRoleTemplate(role);
	const builtPrompt = buildPrompt(roleTemplate, goal, workflowName);
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

async function checkSignal(crewDir: string, role: string): Promise<boolean> {
	try {
		await fs.promises.access(signalPath(crewDir, role));
		return true;
	} catch {
		return false;
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
	goal: string;
	workflowName: string;
	promptedStageIndex: number;
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
	const done = await checkSignal(ctx.crewDir, stageDef.role);
	if (!done) return "continue";

	// Signal detected — clean up and advance
	await removeSignal(ctx.crewDir, stageDef.role);
	console.log(
		`Stage '${currentStage.name}' completed (signal received). Advancing...`,
	);

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
			ctx.goal,
			ctx.workflowName,
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
			ctx.goal,
			ctx.workflowName,
		);
		ctx.promptedStageIndex = idx;
	}
}

async function pollLoop(
	engine: WorkflowEnginePort,
	runner: AgentRunnerPort,
	crewDir: string,
	stages: StageDefinition[],
	goal: string,
	workflowName: string,
	promptedStageIndex: number,
	pollInterval: number,
	signal: AbortSignal,
): Promise<void> {
	const ctx: PollContext = {
		engine,
		runner,
		crewDir,
		stages,
		goal,
		workflowName,
		promptedStageIndex,
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

		await Bun.sleep(pollInterval);
	}
}

interface StartOptions {
	autoApprove?: boolean;
}

export async function startCommand(
	workflowName: string,
	goal: string,
	options?: StartOptions,
): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const configResult = await readConfig(crewDir);
	if (!configResult.ok) {
		console.error(`Error: ${configResult.error}`);
		console.error("Run 'crew init' first.");
		process.exit(1);
	}
	const config = configResult.value;

	const engine = new WorkflowEngine(crewDir);
	const tmux = new Tmux();
	const runner = new AgentRunner(tmux, crewDir, cwd);

	const startResult = await engine.start(workflowName, goal);
	if (!startResult.ok) {
		console.error(`Error: ${startResult.error}`);
		process.exit(1);
	}

	const stageDefsResult = await engine.getStageDefinitions();
	if (!stageDefsResult.ok) {
		console.error(`Error: ${stageDefsResult.error}`);
		process.exit(1);
	}
	const stageDefs = stageDefsResult.value;
	const agents = buildAgentList(stageDefs);

	const sessionResult = await runner.createSession(config.project_name);
	if (!sessionResult.ok) {
		console.error(`Error: ${sessionResult.error}`);
		process.exit(1);
	}

	// Ensure signals directory exists
	await ensureSignalsDir(crewDir);

	await runner.setupLayout(agents.length);

	const autoApprove = options?.autoApprove || config.agent.auto_approve;
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

	console.log(`Workflow '${workflowName}' started with goal: "${goal}"`);
	console.log(`tmux session: crew-${config.project_name}`);

	// Send initial prompt to the first active stage's agent
	let promptedStageIndex = -1;
	const stateResult = await engine.getState();
	if (stateResult.ok) {
		const idx = stateResult.value.currentStageIndex;
		const stage = stateResult.value.stages[idx];
		const def = stageDefs[idx];
		if (stage?.status === "active" && def) {
			console.log(`Sending initial prompt to '${def.role}'...`);
			await promptAgent(runner, def.role, def.role, goal, workflowName);
			promptedStageIndex = idx;
		}
	}

	// Set up signal handlers for graceful cleanup
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
	await pollLoop(
		engine,
		runner,
		crewDir,
		stageDefs,
		goal,
		workflowName,
		promptedStageIndex,
		pollInterval,
		abortController.signal,
	);

	await runner.destroySession();
}
