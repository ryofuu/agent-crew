import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initCommand } from "../../src/cli/commands/init.js";
import { readConfig } from "../../src/cli/config.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(
		path.join(os.tmpdir(), "crew-integ-init-"),
	);
	originalCwd = process.cwd();
	process.chdir(tmpDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("integration: crew init", () => {
	test("creates .crew directory with all required subdirectories", async () => {
		await initCommand({ force: false });
		const crewDir = path.join(tmpDir, ".crew");

		expect(fs.existsSync(crewDir)).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "tasks"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "workflows"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "inbox"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "logs"))).toBe(true);
	});

	test("creates _counter.txt initialized to 0", async () => {
		await initCommand({ force: false });
		const counterPath = path.join(tmpDir, ".crew", "tasks", "_counter.txt");

		expect(fs.existsSync(counterPath)).toBe(true);
		const counter = await fs.promises.readFile(counterPath, "utf-8");
		expect(counter).toBe("0");
	});

	test("creates state.json as empty object", async () => {
		await initCommand({ force: false });
		const statePath = path.join(tmpDir, ".crew", "state.json");

		expect(fs.existsSync(statePath)).toBe(true);
		const content = await fs.promises.readFile(statePath, "utf-8");
		expect(content).toBe("{}");
	});

	test("creates valid config.yaml with project name from directory", async () => {
		await initCommand({ force: false });
		const crewDir = path.join(tmpDir, ".crew");

		const configResult = await readConfig(crewDir);
		expect(configResult.ok).toBe(true);
		if (configResult.ok) {
			expect(configResult.value.project_name).toBe(path.basename(tmpDir));
			expect(configResult.value.defaults.planner_model).toBe("claude-opus-4-6");
			expect(configResult.value.defaults.implementer_model).toBe("codex-1");
			expect(configResult.value.defaults.reviewer_model).toBe(
				"claude-opus-4-6",
			);
		}
	});

	test("creates .gitignore with agent-crew entries", async () => {
		await initCommand({ force: false });
		const gitignorePath = path.join(tmpDir, ".gitignore");

		expect(fs.existsSync(gitignorePath)).toBe(true);
		const content = await fs.promises.readFile(gitignorePath, "utf-8");
		expect(content).toContain(".crew/state.json");
		expect(content).toContain(".crew/logs/");
		expect(content).toContain(".crew/inbox/");
	});

	test("appends to existing .gitignore without duplicates", async () => {
		const gitignorePath = path.join(tmpDir, ".gitignore");
		await fs.promises.writeFile(gitignorePath, "node_modules/\n", "utf-8");

		await initCommand({ force: false });

		const content = await fs.promises.readFile(gitignorePath, "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".crew/state.json");

		// Run init again with --force; entries should not duplicate
		await initCommand({ force: true });
		const content2 = await fs.promises.readFile(gitignorePath, "utf-8");
		const matches = content2.match(/\.crew\/state\.json/g);
		expect(matches?.length).toBe(1);
	});

	test("--force overwrites existing .crew directory", async () => {
		await initCommand({ force: false });

		// Write a marker file inside .crew
		const markerPath = path.join(tmpDir, ".crew", "marker.txt");
		await fs.promises.writeFile(markerPath, "marker", "utf-8");

		// Re-init with --force
		await initCommand({ force: true });

		// .crew should still exist and be valid
		const configResult = await readConfig(path.join(tmpDir, ".crew"));
		expect(configResult.ok).toBe(true);
	});
});
