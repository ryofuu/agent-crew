import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TaskStore } from "../../src/store/TaskStore.js";

let tmpDir: string;
let store: TaskStore;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "crew-test-"));
	store = new TaskStore(tmpDir);
});

afterEach(async () => {
	store.stopWatch();
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("TaskStore", () => {
	describe("nextId", () => {
		test("generates sequential IDs", async () => {
			const r1 = await store.nextId();
			expect(r1.ok).toBe(true);
			if (r1.ok) expect(r1.value).toBe("TASK-001");

			const r2 = await store.nextId();
			expect(r2.ok).toBe(true);
			if (r2.ok) expect(r2.value).toBe("TASK-002");
		});
	});

	describe("create", () => {
		test("creates a task file", async () => {
			const result = await store.create({ title: "Test task" });
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value.frontmatter.id).toBe("TASK-001");
			expect(result.value.frontmatter.title).toBe("Test task");
			expect(result.value.frontmatter.status).toBe("todo");
			expect(result.value.frontmatter.priority).toBe("medium");

			const filePath = store.getTaskFilePath("TASK-001");
			expect(fs.existsSync(filePath)).toBe(true);
		});

		test("creates with custom priority and labels", async () => {
			const result = await store.create({
				title: "Important task",
				priority: "critical",
				labels: ["backend"],
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value.frontmatter.priority).toBe("critical");
			expect(result.value.frontmatter.labels).toEqual(["backend"]);
		});
	});

	describe("get", () => {
		test("retrieves an existing task", async () => {
			await store.create({ title: "Get me" });
			const result = await store.get("TASK-001");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.frontmatter.title).toBe("Get me");
			}
		});

		test("returns error for nonexistent task", async () => {
			const result = await store.get("TASK-999");
			expect(result.ok).toBe(false);
		});
	});

	describe("update", () => {
		test("updates status with valid transition", async () => {
			await store.create({ title: "Update me" });
			const result = await store.update("TASK-001", { status: "in_progress" });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.frontmatter.status).toBe("in_progress");
			}
		});

		test("rejects invalid status transition", async () => {
			await store.create({ title: "Invalid transition" });
			const result = await store.update("TASK-001", { status: "closed" });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("INVALID_TRANSITION");
			}
		});

		test("updates non-status fields without transition validation", async () => {
			await store.create({ title: "Rename me" });
			const result = await store.update("TASK-001", { title: "Renamed" });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.frontmatter.title).toBe("Renamed");
			}
		});
	});

	describe("list", () => {
		test("lists all tasks", async () => {
			await store.create({ title: "Task A" });
			await store.create({ title: "Task B" });
			const result = await store.list();
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(2);
			}
		});

		test("filters by status", async () => {
			await store.create({ title: "Todo task" });
			await store.create({ title: "Another todo" });
			await store.update("TASK-001", { status: "in_progress" });

			const result = await store.list({ status: "todo" });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(1);
				expect(result.value[0]?.frontmatter.id).toBe("TASK-002");
			}
		});

		test("filters by multiple statuses", async () => {
			await store.create({ title: "A" });
			await store.create({ title: "B" });
			await store.update("TASK-001", { status: "in_progress" });

			const result = await store.list({ status: ["todo", "in_progress"] });
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBe(2);
			}
		});
	});

	describe("getTaskFilePath", () => {
		test("returns correct path", () => {
			const p = store.getTaskFilePath("TASK-001");
			expect(p).toContain("TASK-001.md");
		});

		test("rejects path traversal", () => {
			expect(() => store.getTaskFilePath("../../etc/passwd")).toThrow(
				"INVALID_ID",
			);
		});
	});

	describe("ID validation", () => {
		test("rejects invalid task ID on get", async () => {
			const result = await store.get("INVALID");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("INVALID_ID");
			}
		});

		test("rejects invalid task ID on update", async () => {
			const result = await store.update("../evil", {
				status: "in_progress",
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("INVALID_ID");
			}
		});
	});

	describe("atomic write", () => {
		test("no .tmp files left after create", async () => {
			await store.create({ title: "Atomic" });
			const tasksDir = path.join(tmpDir, "tasks");
			const files = await fs.promises.readdir(tasksDir);
			const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
			expect(tmpFiles.length).toBe(0);
		});
	});

	describe("watch", () => {
		test("detects file changes via callback", async () => {
			await store.create({ title: "Watch me" });

			const callbackTasks: import("../../src/store/types.js").Task[] = [];
			const stopWatch = store.watch((task) => {
				callbackTasks.push(task);
			});

			// Wait for initial mtime cache population
			await Bun.sleep(1200);

			// Modify the task to trigger callback
			await store.update("TASK-001", { status: "in_progress" });

			// Wait for poll cycle
			await Bun.sleep(1200);

			expect(callbackTasks.length).toBeGreaterThan(0);
			expect(callbackTasks[0]?.frontmatter.status).toBe("in_progress");

			stopWatch();
		});
	});
});
