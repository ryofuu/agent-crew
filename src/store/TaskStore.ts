import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import type { Result } from "../kernel/index.js";
import { err, ok, TaskStoreErrors } from "../kernel/index.js";
import { isValidTransition } from "./transitions.js";
import {
	type CreateTaskInput,
	type Task,
	type TaskFilter,
	type TaskFrontmatter,
	TaskFrontmatterSchema,
	type TaskStorePort,
	type UpdateTaskInput,
} from "./types.js";

const TASK_ID_PATTERN = /^TASK-\d{3,}$/;

export class TaskStore implements TaskStorePort {
	private readonly tasksDir: string;
	private readonly counterPath: string;
	private watchInterval: ReturnType<typeof setInterval> | null = null;
	private mtimeCache: Map<string, number> = new Map();

	constructor(crewDir: string) {
		this.tasksDir = path.join(crewDir, "tasks");
		this.counterPath = path.join(this.tasksDir, "_counter.txt");
	}

	getTaskFilePath(id: string): string {
		const filePath = path.join(this.tasksDir, `${id}.md`);
		const resolved = path.resolve(filePath);
		const resolvedTasksDir = path.resolve(this.tasksDir);
		if (!resolved.startsWith(`${resolvedTasksDir}${path.sep}`)) {
			throw new Error(`${TaskStoreErrors.INVALID_ID}: path traversal detected`);
		}
		return filePath;
	}

	private validateTaskId(id: string): Result<void, string> {
		if (!TASK_ID_PATTERN.test(id)) {
			return err(
				`${TaskStoreErrors.INVALID_ID}: invalid task ID format: ${id}`,
			);
		}
		return ok(undefined);
	}

	async nextId(): Promise<Result<string, string>> {
		try {
			await fs.promises.mkdir(this.tasksDir, { recursive: true });
			let counter = 0;
			try {
				const raw = await fs.promises.readFile(this.counterPath, "utf-8");
				counter = Number.parseInt(raw.trim(), 10);
			} catch {
				// counter file doesn't exist yet
			}
			counter++;
			const id = `TASK-${String(counter).padStart(3, "0")}`;
			await this.atomicWrite(this.counterPath, String(counter));
			return ok(id);
		} catch (e) {
			return err(`${TaskStoreErrors.WRITE_FAILED}: ${e}`);
		}
	}

	async create(data: CreateTaskInput): Promise<Result<Task, string>> {
		const idResult = await this.nextId();
		if (!idResult.ok) return idResult;
		const id = idResult.value;

		const now = new Date().toISOString();
		const frontmatter: TaskFrontmatter = {
			id,
			title: data.title,
			status: "todo",
			assignee: "",
			priority: data.priority ?? "medium",
			depends_on: data.depends_on ?? [],
			created_at: now,
			updated_at: now,
			stage: data.stage ?? "",
			labels: data.labels ?? [],
		};

		const body =
			data.body ??
			`# ${id}: ${data.title}

## Description

## Acceptance Criteria

## Implementation Notes

## Files Changed
| File | Action | Description |
|------|--------|-------------|

## Review Feedback
`;

		const content = matter.stringify(body, frontmatter);
		const filePath = this.getTaskFilePath(id);

		try {
			await this.atomicWrite(filePath, content);
			return ok({ frontmatter, body, filePath });
		} catch (e) {
			return err(`${TaskStoreErrors.WRITE_FAILED}: ${e}`);
		}
	}

	async update(
		id: string,
		patch: UpdateTaskInput,
	): Promise<Result<Task, string>> {
		const idCheck = this.validateTaskId(id);
		if (!idCheck.ok) return idCheck;

		const existing = await this.get(id);
		if (!existing.ok) return existing;

		const task = existing.value;

		if (patch.status && patch.status !== task.frontmatter.status) {
			if (!isValidTransition(task.frontmatter.status, patch.status)) {
				return err(
					`${TaskStoreErrors.INVALID_TRANSITION}: ${task.frontmatter.status} → ${patch.status}`,
				);
			}
		}

		const updated: TaskFrontmatter = {
			...task.frontmatter,
			...(patch.title !== undefined && { title: patch.title }),
			...(patch.status !== undefined && { status: patch.status }),
			...(patch.assignee !== undefined && { assignee: patch.assignee }),
			...(patch.priority !== undefined && { priority: patch.priority }),
			...(patch.depends_on !== undefined && { depends_on: patch.depends_on }),
			...(patch.stage !== undefined && { stage: patch.stage }),
			...(patch.labels !== undefined && { labels: patch.labels }),
			updated_at: new Date().toISOString(),
		};

		const body = patch.body ?? task.body;
		const content = matter.stringify(body, updated);

		try {
			await this.atomicWrite(task.filePath, content);
			return ok({ frontmatter: updated, body, filePath: task.filePath });
		} catch (e) {
			return err(`${TaskStoreErrors.WRITE_FAILED}: ${e}`);
		}
	}

	async get(id: string): Promise<Result<Task, string>> {
		const idCheck = this.validateTaskId(id);
		if (!idCheck.ok) return idCheck;

		const filePath = this.getTaskFilePath(id);
		try {
			const raw = await fs.promises.readFile(filePath, "utf-8");
			return this.parseTaskFile(raw, filePath);
		} catch {
			return err(`${TaskStoreErrors.TASK_NOT_FOUND}: ${id}`);
		}
	}

	async list(filter?: TaskFilter): Promise<Result<Task[], string>> {
		try {
			await fs.promises.mkdir(this.tasksDir, { recursive: true });
			const files = await fs.promises.readdir(this.tasksDir);
			const taskFiles = files.filter(
				(f) => f.startsWith("TASK-") && f.endsWith(".md"),
			);

			const tasks: Task[] = [];
			for (const file of taskFiles) {
				const filePath = path.join(this.tasksDir, file);
				const raw = await fs.promises.readFile(filePath, "utf-8");
				const result = this.parseTaskFile(raw, filePath);
				if (result.ok) {
					if (this.matchesFilter(result.value, filter)) {
						tasks.push(result.value);
					}
				}
			}

			return ok(tasks);
		} catch (e) {
			return err(`${TaskStoreErrors.READ_FAILED}: ${e}`);
		}
	}

	watch(callback: (task: Task) => void): () => void {
		this.mtimeCache.clear();
		this.watchInterval = setInterval(async () => {
			try {
				const files = await fs.promises.readdir(this.tasksDir);
				const taskFiles = files.filter(
					(f) => f.startsWith("TASK-") && f.endsWith(".md"),
				);

				for (const file of taskFiles) {
					const filePath = path.join(this.tasksDir, file);
					const stat = await fs.promises.stat(filePath);
					const mtime = stat.mtimeMs;
					const cached = this.mtimeCache.get(filePath);

					if (cached !== undefined && cached !== mtime) {
						const raw = await fs.promises.readFile(filePath, "utf-8");
						const result = this.parseTaskFile(raw, filePath);
						if (result.ok) {
							callback(result.value);
						}
					}
					this.mtimeCache.set(filePath, mtime);
				}
			} catch {
				// directory might not exist yet
			}
		}, 1000);

		return () => this.stopWatch();
	}

	stopWatch(): void {
		if (this.watchInterval) {
			clearInterval(this.watchInterval);
			this.watchInterval = null;
		}
		this.mtimeCache.clear();
	}

	private parseTaskFile(raw: string, filePath: string): Result<Task, string> {
		try {
			const { data, content } = matter(raw, { language: "yaml" });
			const parsed = TaskFrontmatterSchema.safeParse(data);
			if (!parsed.success) {
				return err(
					`${TaskStoreErrors.VALIDATION_ERROR}: ${parsed.error.message} in ${filePath}`,
				);
			}
			return ok({ frontmatter: parsed.data, body: content, filePath });
		} catch (e) {
			return err(`${TaskStoreErrors.PARSE_ERROR}: ${e}`);
		}
	}

	private matchesFilter(task: Task, filter?: TaskFilter): boolean {
		if (!filter) return true;
		const fm = task.frontmatter;

		if (filter.status) {
			const statuses = Array.isArray(filter.status)
				? filter.status
				: [filter.status];
			if (!statuses.includes(fm.status)) return false;
		}
		if (filter.assignee !== undefined && fm.assignee !== filter.assignee)
			return false;
		if (filter.stage !== undefined && fm.stage !== filter.stage) return false;
		if (filter.labels && filter.labels.length > 0) {
			if (!filter.labels.some((l) => fm.labels.includes(l))) return false;
		}
		return true;
	}

	private async atomicWrite(filePath: string, content: string): Promise<void> {
		const tmpPath = `${filePath}.tmp`;
		await fs.promises.writeFile(tmpPath, content, "utf-8");
		await fs.promises.rename(tmpPath, filePath);
	}
}
