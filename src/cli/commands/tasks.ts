import * as path from "node:path";
import { TaskStore } from "../../store/index.js";
import type { Task } from "../../store/types.js";
import type { TaskStatus } from "../../kernel/index.js";

/** ステータスごとの表示アイコン */
const STATUS_ICON: Record<TaskStatus, string> = {
	todo: " ",
	ready: "▶",
	in_progress: "⏳",
	dev_done: "✔",
	in_review: "🔍",
	changes_requested: "↩",
	blocked: "🚫",
	closed: "✅",
};

/** ステータスの表示順 */
const STATUS_ORDER: TaskStatus[] = [
	"in_progress",
	"changes_requested",
	"ready",
	"dev_done",
	"in_review",
	"blocked",
	"todo",
	"closed",
];

/** タスク一覧を依存関係付きで表示する */
export async function tasksCommand(): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");
	const store = new TaskStore(crewDir);

	const result = await store.list();
	if (!result.ok || result.value.length === 0) {
		console.log("No tasks found.");
		return;
	}

	const tasks = result.value;
	const taskMap = new Map<string, Task>();
	for (const t of tasks) {
		taskMap.set(t.frontmatter.id, t);
	}

	// ステータス別に集計
	const statusCounts = new Map<TaskStatus, number>();
	for (const t of tasks) {
		const s = t.frontmatter.status;
		statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
	}

	// サマリー表示
	const total = tasks.length;
	const closed = statusCounts.get("closed") ?? 0;
	console.log(`Tasks: ${closed}/${total} completed\n`);

	// ステータス別サマリー行
	const summaryParts: string[] = [];
	for (const s of STATUS_ORDER) {
		const count = statusCounts.get(s);
		if (count && count > 0) {
			summaryParts.push(`${STATUS_ICON[s]} ${s}:${count}`);
		}
	}
	console.log(summaryParts.join("  "));
	console.log();

	// タスク一覧（ステータス順でソート）
	const sorted = [...tasks].sort((a, b) => {
		const ai = STATUS_ORDER.indexOf(a.frontmatter.status);
		const bi = STATUS_ORDER.indexOf(b.frontmatter.status);
		if (ai !== bi) return ai - bi;
		return a.frontmatter.id.localeCompare(b.frontmatter.id);
	});

	for (const task of sorted) {
		const fm = task.frontmatter;
		const icon = STATUS_ICON[fm.status];
		const deps = fm.depends_on.length > 0 ? fm.depends_on.join(",") : "";
		const depsDisplay = deps ? `  ← ${deps}` : "";

		// 依存先が未完了かチェック
		let blockedNote = "";
		if (fm.depends_on.length > 0 && fm.status === "todo") {
			const unresolved = fm.depends_on.filter((depId) => {
				const dep = taskMap.get(depId);
				return dep && dep.frontmatter.status !== "closed";
			});
			if (unresolved.length > 0) {
				blockedNote = ` (waiting: ${unresolved.join(",")})`;
			}
		}

		const assignee = fm.assignee ? `  @${fm.assignee}` : "";
		const status = fm.status.padEnd(18);
		console.log(
			`${icon} ${fm.id}  ${status} ${fm.title}${assignee}${depsDisplay}${blockedNote}`,
		);
	}
}
