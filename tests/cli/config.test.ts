import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { defaultConfig, readConfig, writeConfig } from "../../src/cli/config.js";

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "crew-cli-test-"));
});

afterEach(async () => {
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("Config", () => {
	test("defaultConfig returns valid config", () => {
		const config = defaultConfig("test-project");
		expect(config.project_name).toBe("test-project");
		expect(config.defaults.planner_model).toBe("claude-opus-4-6");
		expect(config.defaults.implementer_model).toBe("codex-1");
		expect(config.workflow.poll_interval_seconds).toBe(5);
	});

	test("writeConfig and readConfig round-trip", async () => {
		const config = defaultConfig("roundtrip-project");
		await writeConfig(tmpDir, config);

		const result = await readConfig(tmpDir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.project_name).toBe("roundtrip-project");
			expect(result.value.defaults.planner_model).toBe("claude-opus-4-6");
		}
	});

	test("readConfig returns error for missing file", async () => {
		const result = await readConfig(path.join(tmpDir, "nonexistent"));
		expect(result.ok).toBe(false);
	});
});
