import * as path from "node:path";
import { TaskStore } from "../../store/TaskStore.js";
import { readState } from "../../workflow/state.js";

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
}
