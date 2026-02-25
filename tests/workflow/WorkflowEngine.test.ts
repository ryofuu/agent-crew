import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { WorkflowEngine } from "../../src/workflow/WorkflowEngine.js";

let tmpDir: string;
let engine: WorkflowEngine;
let templateDir: string;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "crew-wf-test-"));
	templateDir = path.join(tmpDir, "templates");
	await fs.promises.mkdir(templateDir, { recursive: true });

	// Write a test workflow
	await fs.promises.writeFile(
		path.join(templateDir, "test-flow.yaml"),
		`name: test-flow
description: Test workflow
loop_on_changes: false
max_cycles: 3
stages:
  - name: plan
    role: planner
    model: claude-opus-4-6
    human_gate: false
  - name: implement
    role: implementer
    model: codex-1
    human_gate: false
  - name: review
    role: reviewer
    model: claude-opus-4-6
    human_gate: false
`,
	);

	// Write a gated workflow
	await fs.promises.writeFile(
		path.join(templateDir, "gated-flow.yaml"),
		`name: gated-flow
description: Gated workflow
loop_on_changes: true
max_cycles: 2
stages:
  - name: plan
    role: planner
    model: claude-opus-4-6
    human_gate: true
  - name: implement
    role: implementer
    model: codex-1
    human_gate: false
`,
	);

	engine = new WorkflowEngine(tmpDir, [templateDir]);
});

afterEach(async () => {
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("WorkflowEngine", () => {
	describe("start", () => {
		test("starts a workflow successfully", async () => {
			const result = await engine.start("test-flow", "Build something");
			expect(result.ok).toBe(true);

			const state = await engine.getState();
			expect(state.ok).toBe(true);
			if (state.ok) {
				expect(state.value.status).toBe("running");
				expect(state.value.goal).toBe("Build something");
				expect(state.value.cycleCount).toBe(1);
				expect(state.value.stages[0]?.status).toBe("active");
				expect(state.value.stages[1]?.status).toBe("pending");
			}
		});

		test("returns error for already running workflow", async () => {
			await engine.start("test-flow", "Goal 1");
			const result = await engine.start("test-flow", "Goal 2");
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toBe("ALREADY_RUNNING");
		});

		test("returns error for nonexistent workflow", async () => {
			const result = await engine.start("nonexistent", "Goal");
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toContain("WORKFLOW_NOT_FOUND");
		});

		test("starts with waiting_gate for gated workflow", async () => {
			await engine.start("gated-flow", "Gated goal");
			const state = await engine.getState();
			expect(state.ok).toBe(true);
			if (state.ok) {
				expect(state.value.stages[0]?.status).toBe("waiting_gate");
			}
		});
	});

	describe("advance", () => {
		test("advances to next stage", async () => {
			await engine.start("test-flow", "Goal");
			const result = await engine.advance();
			expect(result.ok).toBe(true);

			const state = await engine.getState();
			if (state.ok) {
				expect(state.value.currentStageIndex).toBe(1);
				expect(state.value.stages[0]?.status).toBe("completed");
				expect(state.value.stages[1]?.status).toBe("active");
			}
		});

		test("completes workflow after last stage (no loop)", async () => {
			await engine.start("test-flow", "Goal");
			await engine.advance(); // plan → implement
			await engine.advance(); // implement → review
			await engine.advance(); // review → completed

			const state = await engine.getState();
			if (state.ok) {
				expect(state.value.status).toBe("completed");
			}
		});

		test("returns error when gate is pending", async () => {
			await engine.start("gated-flow", "Goal");
			const result = await engine.advance();
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toBe("GATE_PENDING");
		});
	});

	describe("gate approval", () => {
		test("approveGate activates gated stage", async () => {
			await engine.start("gated-flow", "Goal");
			const approveResult = await engine.approveGate();
			expect(approveResult.ok).toBe(true);

			const state = await engine.getState();
			if (state.ok) {
				expect(state.value.stages[0]?.status).toBe("active");
			}
		});

		test("rejectGate completes workflow", async () => {
			await engine.start("gated-flow", "Goal");
			await engine.rejectGate();

			const state = await engine.getState();
			if (state.ok) {
				expect(state.value.status).toBe("completed");
			}
		});
	});

	describe("pause/resume", () => {
		test("pause and resume", async () => {
			await engine.start("test-flow", "Goal");
			await engine.pause();

			let state = await engine.getState();
			if (state.ok) expect(state.value.status).toBe("paused");

			await engine.resume();
			state = await engine.getState();
			if (state.ok) expect(state.value.status).toBe("running");
		});
	});

	describe("stop", () => {
		test("stops a running workflow", async () => {
			await engine.start("test-flow", "Goal");
			await engine.stop();

			const state = await engine.getState();
			if (state.ok) expect(state.value.status).toBe("completed");
		});
	});

	describe("loop", () => {
		test("loops back to first stage with gated flow", async () => {
			await engine.start("gated-flow", "Goal");
			await engine.approveGate();
			await engine.advance(); // plan → implement
			await engine.advance(); // implement → loop back

			const state = await engine.getState();
			if (state.ok) {
				expect(state.value.cycleCount).toBe(2);
				expect(state.value.currentStageIndex).toBe(0);
				expect(state.value.stages[0]?.status).toBe("waiting_gate");
			}
		});

		test("max_cycles exceeded returns error", async () => {
			await engine.start("gated-flow", "Goal");

			// Cycle 1
			await engine.approveGate();
			await engine.advance();
			await engine.advance();

			// Cycle 2 — should hit max_cycles (2)
			await engine.approveGate();
			await engine.advance();
			const result = await engine.advance();
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toBe("MAX_CYCLES_EXCEEDED");
		});
	});

	describe("canAdvance", () => {
		test("returns true when stage is active", async () => {
			await engine.start("test-flow", "Goal");
			const result = await engine.canAdvance();
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe(true);
		});

		test("returns false when gate is pending", async () => {
			await engine.start("gated-flow", "Goal");
			const result = await engine.canAdvance();
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe(false);
		});
	});

	describe("getCurrentStage", () => {
		test("returns current stage", async () => {
			await engine.start("test-flow", "Goal");
			const result = await engine.getCurrentStage();
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value?.name).toBe("plan");
			}
		});
	});

	describe("getStageDefinitions", () => {
		test("returns stage definitions after start", async () => {
			await engine.start("test-flow", "Goal");
			const result = await engine.getStageDefinitions();
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(3);
				expect(result.value[0]?.role).toBe("planner");
				expect(result.value[1]?.role).toBe("implementer");
				expect(result.value[2]?.role).toBe("reviewer");
			}
		});

		test("returns error before start", async () => {
			const result = await engine.getStageDefinitions();
			expect(result.ok).toBe(false);
		});
	});
});
