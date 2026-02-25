import * as fs from "node:fs";
import * as path from "node:path";
import { defaultConfig, writeConfig } from "../config.js";

export async function initCommand(options: { force?: boolean }): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	if (fs.existsSync(crewDir) && !options.force) {
		console.error("Error: .crew/ already exists. Use --force to overwrite.");
		process.exit(1);
	}

	// Create directory structure
	const dirs = ["workflows", "tasks", "inbox", "logs"];
	for (const dir of dirs) {
		await fs.promises.mkdir(path.join(crewDir, dir), { recursive: true });
	}

	// Create _counter.txt
	await fs.promises.writeFile(
		path.join(crewDir, "tasks", "_counter.txt"),
		"0",
		"utf-8",
	);

	// Create initial state.json
	await fs.promises.writeFile(path.join(crewDir, "state.json"), "{}", "utf-8");

	// Create config.yaml
	const projectName = path.basename(cwd);
	const config = defaultConfig(projectName);
	await writeConfig(crewDir, config);

	// Update .gitignore
	const gitignorePath = path.join(cwd, ".gitignore");
	const gitignoreEntries = [".crew/state.json", ".crew/logs/", ".crew/inbox/"];
	let gitignoreContent = "";
	try {
		gitignoreContent = await fs.promises.readFile(gitignorePath, "utf-8");
	} catch {
		// no .gitignore yet
	}
	const toAdd = gitignoreEntries.filter(
		(entry) => !gitignoreContent.includes(entry),
	);
	if (toAdd.length > 0) {
		const newContent = `${gitignoreContent.trimEnd()}\n\n# agent-crew\n${toAdd.join("\n")}\n`;
		await fs.promises.writeFile(gitignorePath, newContent, "utf-8");
	}

	console.log("Initialized .crew/ directory");
	console.log(`  Project: ${projectName}`);
	console.log("  Run 'crew start <workflow> \"<goal>\"' to begin");
}
