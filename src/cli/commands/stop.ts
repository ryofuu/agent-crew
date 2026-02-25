import * as path from "node:path";
import { AgentRunner, Tmux } from "../../runner/index.js";
import { WorkflowEngine } from "../../workflow/index.js";
import { readConfig } from "../config.js";

export async function stopCommand(_options: {
	force?: boolean;
}): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const configResult = await readConfig(crewDir);
	if (!configResult.ok) {
		console.error("Not initialized. Run 'crew init' first.");
		process.exit(1);
	}
	const config = configResult.value;

	const engine = new WorkflowEngine(crewDir);
	const stopResult = await engine.stop();
	if (!stopResult.ok) {
		console.error(`Error: ${stopResult.error}`);
	}

	const tmux = new Tmux();
	const runner = new AgentRunner(tmux, crewDir, cwd);
	// Restore session name from config so destroySession can find the tmux session
	runner.setSessionName(`crew-${config.project_name}`);
	await runner.destroySession();

	console.log("Workflow stopped.");
}
