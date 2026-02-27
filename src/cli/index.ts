import { Command } from "commander";
import { continueCommand } from "./commands/continue.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { restartCommand } from "./commands/restart.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";
import { tasksCommand } from "./commands/tasks.js";

export function createCLI(): Command {
	const program = new Command();

	program
		.name("crew")
		.description("AI agent crew orchestration CLI")
		.version("0.1.0");

	program
		.command("init")
		.description("Initialize .crew/ directory in current project")
		.option("--force", "Overwrite existing .crew/ directory")
		.action(initCommand);

	program
		.command("start")
		.description("Start a workflow")
		.argument("<workflow>", "Workflow name (e.g., dev-cycle)")
		.argument("<goal>", "Goal description")
		.option("--auto-approve", "Run all agents in auto-approve mode")
		.option(
			"--nudge-interval <seconds>",
			"Override nudge interval in seconds",
			Number.parseInt,
		)
		.option(
			"--keep-session",
			"Keep tmux session alive after workflow completes",
		)
		.action(startCommand);

	program
		.command("continue")
		.description("Continue a previously stopped workflow")
		.option("--auto-approve", "Run all agents in auto-approve mode")
		.option(
			"--nudge-interval <seconds>",
			"Override nudge interval in seconds",
			Number.parseInt,
		)
		.option(
			"--keep-session",
			"Keep tmux session alive after workflow completes",
		)
		.action(continueCommand);

	program
		.command("status")
		.description("Show workflow status")
		.action(statusCommand);

	program
		.command("stop")
		.description("Stop the current workflow")
		.option("--force", "Force stop without confirmation")
		.action(stopCommand);

	program
		.command("list")
		.description("List available workflows")
		.action(listCommand);

	program
		.command("restart")
		.description("Restart a specific agent")
		.argument("<agent>", "Agent name to restart")
		.action(restartCommand);

	const tasks = program
		.command("tasks")
		.description("Task management commands");

	tasks
		.command("list")
		.description("Show task list with status and dependencies")
		.action(tasksCommand);

	program
		.command("doctor")
		.description("Check prerequisites")
		.action(doctorCommand);

	return program;
}
