import * as path from "node:path";
import type { CliType } from "../../kernel/index.js";
import { AgentRunner, Tmux } from "../../runner/index.js";
import type { WorkflowEnginePort } from "../../workflow/index.js";
import { WorkflowEngine } from "../../workflow/index.js";
import type { Config } from "../config.js";
import { readConfig } from "../config.js";

function buildAgentList(config: Config) {
	return [
		{
			name: "planner",
			role: "planner",
			cliType: "claude-code" as CliType,
			model: config.defaults.planner_model,
		},
		{
			name: "implementer",
			role: "implementer",
			cliType: "codex" as CliType,
			model: config.defaults.implementer_model,
		},
		{
			name: "reviewer",
			role: "reviewer",
			cliType: "claude-code" as CliType,
			model: config.defaults.reviewer_model,
		},
	];
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

async function pollLoop(
	engine: WorkflowEnginePort,
	pollInterval: number,
	signal: AbortSignal,
): Promise<void> {
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

	const sessionResult = await runner.createSession(config.project_name);
	if (!sessionResult.ok) {
		console.error(`Error: ${sessionResult.error}`);
		process.exit(1);
	}

	await runner.setupLayout(3);

	for (const agent of buildAgentList(config)) {
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
	await pollLoop(engine, pollInterval, abortController.signal);

	await runner.destroySession();
}
