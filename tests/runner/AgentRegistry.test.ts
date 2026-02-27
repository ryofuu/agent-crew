import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentRegistryData } from "../../src/runner/AgentRegistry.js";
import { AgentRegistry } from "../../src/runner/AgentRegistry.js";

let tmpDir: string;
let registry: AgentRegistry;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(
		path.join(os.tmpdir(), "crew-registry-test-"),
	);
	registry = new AgentRegistry();
});

afterEach(async () => {
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

function sampleData(): AgentRegistryData {
	return {
		sessionName: "crew-test",
		agents: [
			{
				name: "planner",
				role: "planner",
				pane: "crew-test:0.0",
				cliType: "claude-code",
				model: "claude-opus-4-6",
				shellPid: 12345,
				agentPid: 12367,
				spawnedAt: "2026-02-27T10:00:00.000Z",
				respawnCount: 0,
			},
		],
		updatedAt: "2026-02-27T10:00:00.000Z",
	};
}

describe("AgentRegistry", () => {
	describe("save", () => {
		test("writes agents.json atomically", async () => {
			const data = sampleData();
			const result = await registry.save(tmpDir, data);
			expect(result.ok).toBe(true);

			const filePath = path.join(tmpDir, "agents.json");
			const exists = await fs.promises
				.access(filePath)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);

			// Verify no tmp file left behind
			const tmpPath = `${filePath}.tmp`;
			const tmpExists = await fs.promises
				.access(tmpPath)
				.then(() => true)
				.catch(() => false);
			expect(tmpExists).toBe(false);
		});

		test("updates the updatedAt field", async () => {
			const data = sampleData();
			const result = await registry.save(tmpDir, data);
			expect(result.ok).toBe(true);

			const raw = await fs.promises.readFile(
				path.join(tmpDir, "agents.json"),
				"utf-8",
			);
			const parsed = JSON.parse(raw);
			expect(parsed.updatedAt).not.toBe("2026-02-27T10:00:00.000Z");
		});
	});

	describe("load", () => {
		test("reads and validates agents.json", async () => {
			const data = sampleData();
			await registry.save(tmpDir, data);

			const result = await registry.load(tmpDir);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.sessionName).toBe("crew-test");
				expect(result.value.agents.length).toBe(1);
				expect(result.value.agents[0]?.name).toBe("planner");
				expect(result.value.agents[0]?.shellPid).toBe(12345);
			}
		});

		test("returns error for missing file", async () => {
			const result = await registry.load(tmpDir);
			expect(result.ok).toBe(false);
		});

		test("returns error for invalid JSON", async () => {
			await fs.promises.writeFile(path.join(tmpDir, "agents.json"), "not json");
			const result = await registry.load(tmpDir);
			expect(result.ok).toBe(false);
		});

		test("returns error for invalid schema", async () => {
			await fs.promises.writeFile(
				path.join(tmpDir, "agents.json"),
				JSON.stringify({ bad: "data" }),
			);
			const result = await registry.load(tmpDir);
			expect(result.ok).toBe(false);
		});
	});

	describe("round-trip", () => {
		test("save then load preserves data", async () => {
			const data = sampleData();
			data.agents.push({
				name: "implementer",
				role: "implementer",
				pane: "crew-test:0.1",
				cliType: "codex",
				model: "gpt-5.3-codex",
				shellPid: 23456,
				spawnedAt: "2026-02-27T10:00:00.000Z",
				respawnCount: 1,
			});
			await registry.save(tmpDir, data);

			const result = await registry.load(tmpDir);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.agents.length).toBe(2);
				expect(result.value.agents[1]?.name).toBe("implementer");
				expect(result.value.agents[1]?.respawnCount).toBe(1);
			}
		});
	});
});
