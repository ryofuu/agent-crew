import { z } from "zod";
import type { Priority, Result, TaskStatus } from "../kernel/index.js";

export const TaskFrontmatterSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum([
		"todo",
		"in_progress",
		"dev_done",
		"in_review",
		"blocked",
		"changes_requested",
		"closed",
	]),
	assignee: z.string(),
	priority: z.enum(["critical", "high", "medium", "low"]),
	depends_on: z.array(z.string()),
	created_at: z.string(),
	updated_at: z.string(),
	stage: z.string(),
	labels: z.array(z.string()),
});

export interface TaskFrontmatter {
	id: string;
	title: string;
	status: TaskStatus;
	assignee: string;
	priority: Priority;
	depends_on: string[];
	created_at: string;
	updated_at: string;
	stage: string;
	labels: string[];
}

export interface Task {
	frontmatter: TaskFrontmatter;
	body: string;
	filePath: string;
}

export interface CreateTaskInput {
	title: string;
	priority?: Priority;
	depends_on?: string[];
	stage?: string;
	labels?: string[];
	body?: string;
}

export interface UpdateTaskInput {
	title?: string;
	status?: TaskStatus;
	assignee?: string;
	priority?: Priority;
	depends_on?: string[];
	stage?: string;
	labels?: string[];
	body?: string;
}

export interface TaskFilter {
	status?: TaskStatus | TaskStatus[];
	assignee?: string;
	stage?: string;
	labels?: string[];
}

export interface TaskStorePort {
	create(data: CreateTaskInput): Promise<Result<Task, string>>;
	update(id: string, patch: UpdateTaskInput): Promise<Result<Task, string>>;
	get(id: string): Promise<Result<Task, string>>;
	list(filter?: TaskFilter): Promise<Result<Task[], string>>;
	watch(callback: (task: Task) => void): () => void;
	stopWatch(): void;
	nextId(): Promise<Result<string, string>>;
	getTaskFilePath(id: string): string;
}
