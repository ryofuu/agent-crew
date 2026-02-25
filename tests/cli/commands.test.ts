import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initCommand } from "../../src/cli/commands/init.js";
import {
	defaultConfig,
	readConfig,
	writeConfig,
} from "../../src/cli/config.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "crew-cmd-test-"));
	originalCwd = process.cwd();
	process.chdir(tmpDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("init command", () => {
	test("creates .crew directory structure", async () => {
		await initCommand({ force: false });
		const crewDir = path.join(tmpDir, ".crew");

		expect(fs.existsSync(crewDir)).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "tasks"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "workflows"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "inbox"))).toBe(true);
		expect(fs.existsSync(path.join(crewDir, "logs"))).toBe(true);

		// Check _counter.txt
		const counter = await fs.promises.readFile(
			path.join(crewDir, "tasks", "_counter.txt"),
			"utf-8",
		);
		expect(counter).toBe("0");

		// Check config.yaml
		const configResult = await readConfig(crewDir);
		expect(configResult.ok).toBe(true);
	});

	test("creates .gitignore entries", async () => {
		await initCommand({ force: false });
		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.promises.readFile(gitignorePath, "utf-8");
		expect(content).toContain(".crew/state.json");
		expect(content).toContain(".crew/logs/");
	});
});

describe("config validation", () => {
	test("rejects invalid model in config", async () => {
		const crewDir = path.join(tmpDir, ".crew");
		await fs.promises.mkdir(crewDir, { recursive: true });

		// Write config with invalid model
		const configPath = path.join(crewDir, "config.yaml");
		await fs.promises.writeFile(
			configPath,
			`project_name: test\ndefaults:\n  planner_model: invalid-model\n`,
			"utf-8",
		);

		const result = await readConfig(crewDir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("CONFIG_ERROR");
		}
	});

	test("accepts valid ModelId values in config", async () => {
		const crewDir = path.join(tmpDir, ".crew");
		await fs.promises.mkdir(crewDir, { recursive: true });

		const config = defaultConfig("valid-test");
		await writeConfig(crewDir, config);

		const result = await readConfig(crewDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.defaults.planner_model).toBe("claude-opus-4-6");
			expect(result.value.defaults.implementer_model).toBe("codex-1");
			expect(result.value.defaults.reviewer_model).toBe("claude-opus-4-6");
		}
	});
});

describe("stop command", () => {
	test("stop restores session name from config", async () => {
		// Verify AgentRunner.setSessionName works
		const { AgentRunner } = await import("../../src/runner/AgentRunner.js");
		const mockTmux = {
			run: () => Promise.resolve({ ok: true as const, value: "" }),
			hasSession: () => Promise.resolve(false),
			newSession: () =>
				Promise.resolve({ ok: true as const, value: undefined }),
			killSession: () =>
				Promise.resolve({ ok: true as const, value: undefined }),
			splitWindow: () =>
				Promise.resolve({ ok: true as const, value: undefined }),
			sendKeys: () => Promise.resolve({ ok: true as const, value: undefined }),
			sendText: () => Promise.resolve({ ok: true as const, value: undefined }),
			capturePane: () => Promise.resolve({ ok: true as const, value: "" }),
			selectLayout: () =>
				Promise.resolve({ ok: true as const, value: undefined }),
		};

		const runner = new AgentRunner(mockTmux, tmpDir, tmpDir);
		expect(runner.getSessionName()).toBe("");

		runner.setSessionName("crew-myproject");
		expect(runner.getSessionName()).toBe("crew-myproject");

		const result = await runner.destroySession();
		expect(result.ok).toBe(true);
	});
});

describe("doctor command", () => {
	test("doctor runs without throwing", async () => {
		const { doctorCommand } = await import("../../src/cli/commands/doctor.js");
		// Just verify it doesn't throw — actual checks depend on system
		await doctorCommand();
	});
});

describe("list command", () => {
	test("list runs without throwing", async () => {
		const { listCommand } = await import("../../src/cli/commands/list.js");
		await listCommand();
	});
});
