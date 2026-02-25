import * as path from "node:path";
import type { CliType, ModelId } from "../../kernel/index.js";
import { AgentRunner } from "../../runner/AgentRunner.js";
import { Tmux } from "../../runner/tmux.js";
import { WorkflowEngine } from "../../workflow/WorkflowEngine.js";
import { readConfig } from "../config.js";

export async function startCommand(workflowName: string, goal: string): Promise<void> {
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

	// Start workflow
	const startResult = await engine.start(workflowName, goal);
	if (!startResult.ok) {
		console.error(`Error: ${startResult.error}`);
		process.exit(1);
	}

	// Create tmux session
	const sessionResult = await runner.createSession(config.project_name);
	if (!sessionResult.ok) {
		console.error(`Error: ${sessionResult.error}`);
		process.exit(1);
	}

	// Setup layout
	await runner.setupLayout(3);

	// Spawn agents
	const agents: { name: string; role: string; cliType: CliType; model: ModelId }[] = [
		{
			name: "planner",
			role: "planner",
			cliType: "claude-code",
			model: config.defaults.planner_model as ModelId,
		},
		{
			name: "implementer",
			role: "implementer",
			cliType: "codex",
			model: config.defaults.implementer_model as ModelId,
		},
		{
			name: "reviewer",
			role: "reviewer",
			cliType: "claude-code",
			model: config.defaults.reviewer_model as ModelId,
		},
	];

	for (const agent of agents) {
		const result = await runner.spawn(agent.name, agent.role, agent.cliType, agent.model);
		if (!result.ok) {
			console.error(`Error spawning ${agent.name}: ${result.error}`);
		}
	}

	console.log(`Workflow '${workflowName}' started with goal: "${goal}"`);
	console.log(`tmux session: crew-${config.project_name}`);

	// Main loop
	const pollInterval = config.workflow.poll_interval_seconds * 1000;
	while (true) {
		const stateResult = await engine.getState();
		if (!stateResult.ok) break;

		const state = stateResult.value;
		if (state.status === "completed") {
			console.log("Workflow completed.");
			break;
		}
		if (state.status === "error") {
			console.error("Workflow error.");
			break;
		}

		const stageResult = await engine.getCurrentStage();
		if (stageResult.ok && stageResult.value?.status === "waiting_gate") {
			const stageName = stageResult.value.name;
			console.log(`\nGate: '${stageName}' stage requires approval.`);
			const answer = prompt("Approve? [y/N]: ");
			if (answer?.toLowerCase() === "y") {
				await engine.approveGate();
				console.log("Gate approved.");
			} else {
				await engine.rejectGate();
				console.log("Gate rejected. Workflow stopped.");
				break;
			}
		}

		await Bun.sleep(pollInterval);
	}

	// Cleanup
	await runner.destroySession();
}
