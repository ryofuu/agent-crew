export interface RequestEntry {
	timestamp: string;
	title: string;
	body: string;
	done: boolean;
}

const HEADING_RE =
	/^## \s*(?:\[done\]\s*)?\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*(.+)$/;
const DONE_RE = /^## \s*\[done\]/;

export function parseRequest(content: string): RequestEntry[] {
	const lines = content.split("\n");
	const entries: RequestEntry[] = [];
	let current: RequestEntry | null = null;

	for (const line of lines) {
		const match = HEADING_RE.exec(line);
		if (match?.[1] && match[2]) {
			if (current) entries.push(current);
			current = {
				timestamp: match[1],
				title: match[2].trim(),
				body: "",
				done: DONE_RE.test(line),
			};
			continue;
		}
		if (current) {
			current.body += `${line}\n`;
		}
	}
	if (current) entries.push(current);

	// Trim trailing whitespace from body
	for (const entry of entries) {
		entry.body = entry.body.trim();
	}

	return entries;
}

export function getActiveGoal(entries: RequestEntry[]): string {
	const active = entries.filter((e) => !e.done);
	if (active.length === 0) return "";

	return active
		.map((e) => {
			const header = `[${e.timestamp}] ${e.title}`;
			return e.body ? `${header}\n${e.body}` : header;
		})
		.join("\n\n");
}

export function formatNewEntry(title: string, body: string): string {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	const hh = String(now.getHours()).padStart(2, "0");
	const min = String(now.getMinutes()).padStart(2, "0");
	const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

	const heading = `## [${timestamp}] ${title}`;
	return body ? `${heading}\n\n${body}` : heading;
}
