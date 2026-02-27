import * as path from "node:path";
import { ClaudeCodeAdapter } from "../../runner/adapters/ClaudeCodeAdapter.js";
import { CodexAdapter } from "../../runner/adapters/CodexAdapter.js";
import { AgentRegistry, ProcessProbe, Tmux } from "../../runner/index.js";
import { readState } from "../../workflow/index.js";

export async function restartCommand(agentName: string): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const registry = new AgentRegistry();
	const registryResult = await registry.load(crewDir);
	if (!registryResult.ok) {
		console.error("No agents.json found. Is a workflow running?");
		process.exit(1);
	}

	const data = registryResult.value;
	const agentRecord = data.agents.find((a) => a.name === agentName);
	if (!agentRecord) {
		console.error(
			`Agent '${agentName}' not found. Available: ${data.agents.map((a) => a.name).join(", ")}`,
		);
		process.exit(1);
	}

	const probe = new ProcessProbe();
	const tmux = new Tmux();

	// Kill existing agent process
	if (agentRecord.agentPid && probe.isAlive(agentRecord.agentPid)) {
		console.log(`Killing agent process (PID: ${agentRecord.agentPid})...`);
		try {
			process.kill(agentRecord.agentPid, "SIGTERM");
		} catch {
			// already dead
		}
	}

	// Send C-c to clean up the pane
	await tmux.sendKeys(agentRecord.pane, "C-c");
	await Bun.sleep(500);

	// Re-launch CLI
	const adapter =
		agentRecord.cliType === "claude-code"
			? new ClaudeCodeAdapter()
			: new CodexAdapter();
	const command = adapter.startCommand(agentRecord.model, cwd);
	console.log(`Restarting '${agentName}' in pane ${agentRecord.pane}...`);
	await tmux.sendText(agentRecord.pane, command);

	// Update registry
	agentRecord.respawnCount++;
	agentRecord.spawnedAt = new Date().toISOString();
	agentRecord.agentPid = undefined;
	await registry.save(crewDir, data);

	// Check if current workflow stage matches this agent for prompt re-send
	const stateResult = await readState(crewDir);
	if (stateResult.ok) {
		const state = stateResult.value;
		const currentStage = state.stages[state.currentStageIndex];
		if (currentStage && currentStage.name === agentName) {
			console.log(
				`Agent '${agentName}' is the active stage. Prompt will be re-sent on next poll cycle.`,
			);
		}
	}

	console.log(`Agent '${agentName}' restarted successfully.`);
}
