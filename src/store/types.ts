import type { Priority, Result, TaskStatus } from "../kernel/index.js";

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
