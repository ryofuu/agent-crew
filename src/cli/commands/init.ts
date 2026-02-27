import * as fs from "node:fs";
import * as path from "node:path";
import { defaultConfig, readConfig, writeConfig } from "../config.js";

export async function initCommand(options: { force?: boolean }): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	if (fs.existsSync(crewDir) && !options.force) {
		console.error("Error: .crew/ already exists. Use --force to overwrite.");
		process.exit(1);
	}

	// Create directory structure
	const dirs = ["tasks", "inbox", "logs", "signals"];
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

	// Create REQUEST.md template if it doesn't exist
	const requestPath = path.join(crewDir, "REQUEST.md");
	if (!fs.existsSync(requestPath)) {
		await fs.promises.writeFile(
			requestPath,
			"# Request\n\n<!-- crew start で自動追記されます。手動で依頼を追加することもできます。 -->\n<!-- 完了した依頼は ## [done] [YYYY-MM-DD HH:MM] タイトル に変更してください。 -->\n",
			"utf-8",
		);
	}

	// Create CONTEXT.md from template if it doesn't exist
	const contextPath = path.join(crewDir, "CONTEXT.md");
	if (!fs.existsSync(contextPath)) {
		const templatePath = path.join(
			import.meta.dir,
			"../../../templates/CONTEXT.md",
		);
		try {
			const template = await fs.promises.readFile(templatePath, "utf-8");
			await fs.promises.writeFile(contextPath, template, "utf-8");
		} catch {
			// template not found, create minimal
			await fs.promises.writeFile(
				contextPath,
				"# Shared Context\n\n<!-- ワークフロー間で共有するコンテキストを記述 -->\n",
				"utf-8",
			);
		}
	}

	// Create LOG.md for session logs if it doesn't exist
	const logPath = path.join(crewDir, "LOG.md");
	if (!fs.existsSync(logPath)) {
		await fs.promises.writeFile(
			logPath,
			"# Session Log\n\n各エージェントのセッション作業記録。時系列で追記される。\n",
			"utf-8",
		);
	}

	// Create global config if it doesn't exist
	const existingConfig = await readConfig();
	if (!existingConfig.ok) {
		const config = defaultConfig();
		await writeConfig(config);
	}

	// Update .gitignore
	const gitignorePath = path.join(cwd, ".gitignore");
	const gitignoreEntries = [
		".crew/state.json",
		".crew/logs/",
		".crew/inbox/",
		".crew/signals/",
	];
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

	const projectName = path.basename(cwd);
	console.log("Initialized .crew/ directory");
	console.log(`  Project: ${projectName}`);
	console.log("  Run 'crew start <workflow> \"<goal>\"' to begin");
}
