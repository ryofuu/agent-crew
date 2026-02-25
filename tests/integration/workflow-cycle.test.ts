import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initCommand } from "../../src/cli/commands/init.js";
import { AgentRunner } from "../../src/runner/AgentRunner.js";
import { TaskStore } from "../../src/store/TaskStore.js";
import { readState } from "../../src/workflow/state.js";
import { WorkflowEngine } from "../../src/workflow/WorkflowEngine.js";
import { setupWorkflowFixtures } from "../helpers/fixtures.js";
import { createMockTmux } from "../helpers/mocks.js";

let tmpDir: string;
let crewDir: string;
let originalCwd: string;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(
		path.join(os.tmpdir(), "crew-integ-cycle-"),
	);
	originalCwd = process.cwd();
	process.chdir(tmpDir);

	// Initialize project
	await initCommand({ force: false });
	crewDir = path.join(tmpDir, ".crew");

	// Copy workflow fixtures into .crew/workflows/
	await setupWorkflowFixtures(crewDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("integration: workflow cycle", () => {
	test("crew start sets workflow state to running", async () => {
		const engine = new WorkflowEngine(crewDir);
		const result = await engine.start("dev-cycle", "Build MVP");
		expect(result.ok).toBe(true);

		const stateResult = await readState(crewDir);
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			expect(stateResult.value.status).toBe("running");
			expect(stateResult.value.workflowName).toBe("dev-cycle");
			expect(stateResult.value.goal).toBe("Build MVP");
			expect(stateResult.value.cycleCount).toBe(1);
			expect(stateResult.value.stages).toHaveLength(3);
			expect(stateResult.value.stages[0]?.status).toBe("waiting_gate");
		}
	});

	test("crew stop transitions workflow from running to completed", async () => {
		const engine = new WorkflowEngine(crewDir);
		await engine.start("simple-flow", "Test goal");

		const stopResult = await engine.stop();
		expect(stopResult.ok).toBe(true);

		const stateResult = await readState(crewDir);
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			expect(stateResult.value.status).toBe("completed");
		}
	});

	test("AgentRunner creates and destroys session with mock tmux", async () => {
		const mockTmux = createMockTmux();
		const runner = new AgentRunner(mockTmux, crewDir, tmpDir);

		const createResult = await runner.createSession("test-project");
		expect(createResult.ok).toBe(true);
		expect(runner.getSessionName()).toBe("crew-test-project");

		const layoutResult = await runner.setupLayout(3);
		expect(layoutResult.ok).toBe(true);

		const spawnResult = await runner.spawn(
			"planner",
			"planner",
			"claude-code",
			"claude-opus-4-6",
		);
		expect(spawnResult.ok).toBe(true);

		const destroyResult = await runner.destroySession();
		expect(destroyResult.ok).toBe(true);
		expect(runner.getSessionName()).toBe("");
	});

	test("task lifecycle: create → todo → in_progress → dev_done → in_review → closed", async () => {
		const store = new TaskStore(crewDir);

		// Create a task
		const createResult = await store.create({
			title: "Implement feature A",
			priority: "high",
			stage: "implement",
			labels: ["feature"],
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const taskId = createResult.value.frontmatter.id;
		expect(taskId).toBe("TASK-001");
		expect(createResult.value.frontmatter.status).toBe("todo");

		// todo → in_progress
		const ip = await store.update(taskId, {
			status: "in_progress",
			assignee: "implementer-1",
		});
		expect(ip.ok).toBe(true);
		if (ip.ok) expect(ip.value.frontmatter.status).toBe("in_progress");

		// in_progress → dev_done
		const dd = await store.update(taskId, { status: "dev_done" });
		expect(dd.ok).toBe(true);
		if (dd.ok) expect(dd.value.frontmatter.status).toBe("dev_done");

		// dev_done → in_review
		const ir = await store.update(taskId, { status: "in_review" });
		expect(ir.ok).toBe(true);
		if (ir.ok) expect(ir.value.frontmatter.status).toBe("in_review");

		// in_review → closed
		const cl = await store.update(taskId, { status: "closed" });
		expect(cl.ok).toBe(true);
		if (cl.ok) expect(cl.value.frontmatter.status).toBe("closed");

		// Verify final state by re-reading
		const final = await store.get(taskId);
		expect(final.ok).toBe(true);
		if (final.ok) {
			expect(final.value.frontmatter.status).toBe("closed");
			expect(final.value.frontmatter.assignee).toBe("implementer-1");
		}
	});

	test("invalid task status transitions are rejected", async () => {
		const store = new TaskStore(crewDir);

		const createResult = await store.create({ title: "Task B" });
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const taskId = createResult.value.frontmatter.id;

		// todo → closed is invalid
		const result = await store.update(taskId, { status: "closed" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("INVALID_TRANSITION");
		}
	});

	test("full workflow: start → advance through stages → complete (simple-flow)", async () => {
		const engine = new WorkflowEngine(crewDir);
		await engine.start("simple-flow", "Integration test goal");

		// Stage 0 (plan) is active
		let state = await engine.getState();
		expect(state.ok).toBe(true);
		if (state.ok) {
			expect(state.value.currentStageIndex).toBe(0);
			expect(state.value.stages[0]?.status).toBe("active");
		}

		// Advance: plan → implement
		let advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.currentStageIndex).toBe(1);
			expect(state.value.stages[0]?.status).toBe("completed");
			expect(state.value.stages[1]?.status).toBe("active");
		}

		// Advance: implement → review
		advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.currentStageIndex).toBe(2);
			expect(state.value.stages[1]?.status).toBe("completed");
			expect(state.value.stages[2]?.status).toBe("active");
		}

		// Advance: review → completed (no loop)
		advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.status).toBe("completed");
			expect(state.value.stages[2]?.status).toBe("completed");
		}
	});

	test("dev-cycle workflow: gate → approve → advance → loop", async () => {
		const engine = new WorkflowEngine(crewDir);
		await engine.start("dev-cycle", "Dev cycle test");

		// Stage 0 (plan) has human_gate → waiting_gate
		let state = await engine.getState();
		if (state.ok) {
			expect(state.value.stages[0]?.status).toBe("waiting_gate");
		}

		// Cannot advance while gate is pending
		let advResult = await engine.advance();
		expect(advResult.ok).toBe(false);

		// Approve gate
		const approveResult = await engine.approveGate();
		expect(approveResult.ok).toBe(true);

		state = await engine.getState();
		if (state.ok) {
			expect(state.value.stages[0]?.status).toBe("active");
		}

		// Advance: plan → implement (no gate)
		advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.currentStageIndex).toBe(1);
			expect(state.value.stages[1]?.status).toBe("active");
		}

		// Advance: implement → review (has gate)
		advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.currentStageIndex).toBe(2);
			expect(state.value.stages[2]?.status).toBe("waiting_gate");
		}

		// Approve review gate
		await engine.approveGate();

		// Advance: review → loop back to plan (cycle 2)
		advResult = await engine.advance();
		expect(advResult.ok).toBe(true);
		state = await engine.getState();
		if (state.ok) {
			expect(state.value.cycleCount).toBe(2);
			expect(state.value.currentStageIndex).toBe(0);
			expect(state.value.stages[0]?.status).toBe("waiting_gate");
		}
	});

	test("combined: init + start + task creation + status read + stop", async () => {
		// 1. Start workflow
		const engine = new WorkflowEngine(crewDir);
		await engine.start("simple-flow", "Combined test");

		// 2. Create tasks
		const store = new TaskStore(crewDir);
		const task1 = await store.create({
			title: "Task 1",
			priority: "high",
			stage: "plan",
		});
		expect(task1.ok).toBe(true);

		const task2 = await store.create({
			title: "Task 2",
			priority: "medium",
			stage: "implement",
			depends_on: ["TASK-001"],
		});
		expect(task2.ok).toBe(true);

		// 3. Verify task listing
		const listResult = await store.list();
		expect(listResult.ok).toBe(true);
		if (listResult.ok) {
			expect(listResult.value).toHaveLength(2);
		}

		// 4. Filter tasks by status
		const todoTasks = await store.list({ status: "todo" });
		expect(todoTasks.ok).toBe(true);
		if (todoTasks.ok) {
			expect(todoTasks.value).toHaveLength(2);
		}

		// 5. Update task 1 through lifecycle
		await store.update("TASK-001", { status: "in_progress" });
		await store.update("TASK-001", { status: "dev_done" });
		await store.update("TASK-001", { status: "in_review" });
		await store.update("TASK-001", { status: "closed" });

		// 6. Filter by closed
		const closedTasks = await store.list({ status: "closed" });
		expect(closedTasks.ok).toBe(true);
		if (closedTasks.ok) {
			expect(closedTasks.value).toHaveLength(1);
			expect(closedTasks.value[0]?.frontmatter.id).toBe("TASK-001");
		}

		// 7. Verify state is still running
		const stateResult = await engine.getState();
		expect(stateResult.ok).toBe(true);
		if (stateResult.ok) {
			expect(stateResult.value.status).toBe("running");
		}

		// 8. Stop workflow
		await engine.stop();
		const finalState = await readState(crewDir);
		expect(finalState.ok).toBe(true);
		if (finalState.ok) {
			expect(finalState.value.status).toBe("completed");
		}
	});

	test("task changes_requested re-implementation flow", async () => {
		const store = new TaskStore(crewDir);

		const createResult = await store.create({
			title: "Feature with review feedback",
			priority: "high",
		});
		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const id = createResult.value.frontmatter.id;

		// todo → in_progress → dev_done → in_review → changes_requested
		await store.update(id, { status: "in_progress" });
		await store.update(id, { status: "dev_done" });
		await store.update(id, { status: "in_review" });
		await store.update(id, { status: "changes_requested" });

		let task = await store.get(id);
		expect(task.ok).toBe(true);
		if (task.ok) {
			expect(task.value.frontmatter.status).toBe("changes_requested");
		}

		// Re-implementation: changes_requested → in_progress → dev_done → in_review → closed
		await store.update(id, { status: "in_progress" });
		await store.update(id, { status: "dev_done" });
		await store.update(id, { status: "in_review" });
		const closeResult = await store.update(id, { status: "closed" });
		expect(closeResult.ok).toBe(true);

		task = await store.get(id);
		if (task.ok) {
			expect(task.value.frontmatter.status).toBe("closed");
		}
	});

	test("multiple tasks with counter increment", async () => {
		const store = new TaskStore(crewDir);

		const t1 = await store.create({ title: "Task A" });
		const t2 = await store.create({ title: "Task B" });
		const t3 = await store.create({ title: "Task C" });

		expect(t1.ok).toBe(true);
		expect(t2.ok).toBe(true);
		expect(t3.ok).toBe(true);

		if (t1.ok) expect(t1.value.frontmatter.id).toBe("TASK-001");
		if (t2.ok) expect(t2.value.frontmatter.id).toBe("TASK-002");
		if (t3.ok) expect(t3.value.frontmatter.id).toBe("TASK-003");

		// Verify counter persisted
		const counterPath = path.join(crewDir, "tasks", "_counter.txt");
		const counter = await fs.promises.readFile(counterPath, "utf-8");
		expect(counter.trim()).toBe("3");
	});
});
