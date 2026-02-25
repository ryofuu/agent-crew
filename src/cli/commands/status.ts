import * as path from "node:path";
import { Tmux } from "../../runner/index.js";
import { TaskStore } from "../../store/index.js";
import type { WorkflowState } from "../../workflow/index.js";
import { readState } from "../../workflow/index.js";

async function printAgentStatus(state: WorkflowState): Promise<void> {
	const cwd = process.cwd();
	const projectName = path.basename(cwd);
	const sessionName = `crew-${projectName}`;
	const tmux = new Tmux();
	const hasSession = await tmux.hasSession(sessionName);

	if (!hasSession) {
		console.log("Agents: (no tmux session)");
		return;
	}

	console.log("Agents:");
	const panesResult = await tmux.run([
		"list-panes",
		"-t",
		sessionName,
		"-F",
		"#{pane_index}:#{pane_pid}",
	]);
	if (!panesResult.ok) {
		console.log("Agents: (unable to query tmux panes)");
		return;
	}

	const panes = panesResult.value.split("\n").filter((l) => l.trim());
	const agentNames = state.stages.map((s) => s.name);
	for (let i = 0; i < panes.length; i++) {
		const name = agentNames[i] ?? `pane-${i}`;
		const parts = panes[i]?.split(":") ?? [];
		const pid = parts[1] ?? "?";
		console.log(`  ${name.padEnd(14)} pane:${i}  pid:${pid}  active`);
	}
}

export async function statusCommand(): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const stateResult = await readState(crewDir);
	if (!stateResult.ok) {
		console.error("No active workflow. Run 'crew start' first.");
		process.exit(1);
	}
	const state = stateResult.value;

	const currentStage = state.stages[state.currentStageIndex];

	console.log(
		`Workflow: ${state.workflowName}  Status: ${state.status}  Cycle: ${state.cycleCount}`,
	);
	console.log(
		`Stage: ${currentStage?.name ?? "none"} (${currentStage?.status ?? "unknown"})`,
	);
	console.log();

	// Tasks
	const store = new TaskStore(crewDir);
	const tasksResult = await store.list();
	if (tasksResult.ok && tasksResult.value.length > 0) {
		console.log("Tasks:");
		for (const task of tasksResult.value) {
			const fm = task.frontmatter;
			const assignee = fm.assignee || "-";
			console.log(`  ${fm.id} [${fm.status}] ${fm.title}  (${assignee})`);
		}
	} else {
		console.log("Tasks: (none)");
	}

	// Agents
	console.log();
	await printAgentStatus(state);
}
