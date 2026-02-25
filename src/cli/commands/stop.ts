import * as path from "node:path";
import { AgentRunner, Tmux } from "../../runner/index.js";
import { WorkflowEngine } from "../../workflow/index.js";

export async function stopCommand(_options: {
	force?: boolean;
}): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");
	const projectName = path.basename(cwd);

	const engine = new WorkflowEngine(crewDir);
	const stopResult = await engine.stop();
	if (!stopResult.ok) {
		console.error(`Error: ${stopResult.error}`);
	}

	const tmux = new Tmux();
	const runner = new AgentRunner(tmux, crewDir, cwd);
	runner.setSessionName(`crew-${projectName}`);
	await runner.destroySession();

	console.log("Workflow stopped.");
}
