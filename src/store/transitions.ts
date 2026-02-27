import type { TaskStatus } from "../kernel/index.js";

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
	todo: ["ready"],
	ready: ["in_progress"],
	in_progress: ["dev_done", "blocked"],
	dev_done: ["in_review"],
	in_review: ["closed", "changes_requested"],
	changes_requested: ["in_progress"],
	blocked: ["in_progress"],
	closed: [],
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}
