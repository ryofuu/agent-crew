import * as fs from "node:fs";
import * as path from "node:path";
import type { CliType, ModelId } from "../../kernel/index.js";
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
	model: ModelId;
}

function buildAgentList(stages: StageDefinition[]): AgentEntry[] {
	return stages.map((stage) => ({
		name: stage.role,
		role: stage.role,
		cliType: (stage.model.startsWith("codex")
			? "codex"
			: "claude-code") as CliType,
		model: stage.model as ModelId,
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
	const prompt = buildPrompt(roleTemplate, goal, workflowName);
	await runner.waitForReady(agentName, AGENT_READY_TIMEOUT_MS);
	const result = await runner.sendInitialPrompt(agentName, prompt);
	if (!result.ok) {
		console.error(`Error sending prompt to ${agentName}: ${result.error}`);
	}
}

interface PollContext {
	engine: WorkflowEnginePort;
	runner: AgentRunnerPort;
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

	const status = await ctx.runner.getStatus(stageDef.role);
	if (!status.ok || status.value !== "idle") return "continue";

	console.log(`Stage '${currentStage.name}' agent finished. Advancing...`);
	const advResult = await ctx.engine.advance();
	if (!advResult.ok) {
		console.error(`Error advancing: ${advResult.error}`);
		return "break";
	}

	// Prompt next stage's agent if newly active
	const newState = await ctx.engine.getState();
	if (!newState.ok || newState.value.status !== "running") return "continue";

	const nextIdx = newState.value.currentStageIndex;
	const nextStage = newState.value.stages[nextIdx];
	const nextDef = ctx.stages[nextIdx];
	if (
		nextStage?.status === "active" &&
		nextDef &&
		nextIdx > ctx.promptedStageIndex
	) {
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

async function pollLoop(
	engine: WorkflowEnginePort,
	runner: AgentRunnerPort,
	stages: StageDefinition[],
	goal: string,
	workflowName: string,
	pollInterval: number,
	signal: AbortSignal,
): Promise<void> {
	const ctx: PollContext = {
		engine,
		runner,
		stages,
		goal,
		workflowName,
		promptedStageIndex: 0,
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

		const action = await tryAdvanceStage(ctx);
		if (action === "break") break;

		await Bun.sleep(pollInterval);
	}
}

export async function startCommand(
	workflowName: string,
	goal: string,
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

	await runner.setupLayout(agents.length);

	for (const agent of agents) {
		const result = await runner.spawn(
			agent.name,
			agent.role,
			agent.cliType,
			agent.model,
		);
		if (!result.ok) {
			console.error(`Error spawning ${agent.name}: ${result.error}`);
		}
	}

	console.log(`Workflow '${workflowName}' started with goal: "${goal}"`);
	console.log(`tmux session: crew-${config.project_name}`);

	// Send initial prompt to the first active stage's agent
	const stateResult = await engine.getState();
	if (stateResult.ok) {
		const idx = stateResult.value.currentStageIndex;
		const stage = stateResult.value.stages[idx];
		const def = stageDefs[idx];
		if (stage?.status === "active" && def) {
			console.log(`Sending initial prompt to '${def.role}'...`);
			await promptAgent(runner, def.role, def.role, goal, workflowName);
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
		stageDefs,
		goal,
		workflowName,
		pollInterval,
		abortController.signal,
	);

	await runner.destroySession();
}
