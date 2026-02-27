import { describe, expect, test } from "bun:test";
import {
	formatNewEntry,
	getActiveGoal,
	parseRequest,
} from "../../src/workflow/request.js";

describe("parseRequest", () => {
	test("parses multiple entries with done marks", () => {
		const content = `# Request

## [2026-02-27 14:30] ログイン機能の実装

ユーザー認証のためのログイン画面を作成してください。
- メールアドレスとパスワードでログイン
- JWT トークンを使用

## [done] [2026-02-27 14:45] データベーステーブル追加

users テーブルを追加してください。

## [2026-02-27 15:10] エラーハンドリング改善

API エラー時のユーザー体験を改善してください。
`;

		const entries = parseRequest(content);
		expect(entries).toHaveLength(3);

		expect(entries[0]?.timestamp).toBe("2026-02-27 14:30");
		expect(entries[0]?.title).toBe("ログイン機能の実装");
		expect(entries[0]?.done).toBe(false);
		expect(entries[0]?.body).toContain("JWT トークンを使用");

		expect(entries[1]?.timestamp).toBe("2026-02-27 14:45");
		expect(entries[1]?.title).toBe("データベーステーブル追加");
		expect(entries[1]?.done).toBe(true);
		expect(entries[1]?.body).toContain("users テーブル");

		expect(entries[2]?.timestamp).toBe("2026-02-27 15:10");
		expect(entries[2]?.title).toBe("エラーハンドリング改善");
		expect(entries[2]?.done).toBe(false);
	});

	test("returns empty array for empty content", () => {
		expect(parseRequest("")).toEqual([]);
	});

	test("returns empty array for header-only content", () => {
		expect(parseRequest("# Request\n")).toEqual([]);
	});

	test("parses entry without body", () => {
		const content = "## [2026-01-01 10:00] タイトルだけ\n";
		const entries = parseRequest(content);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.title).toBe("タイトルだけ");
		expect(entries[0]?.body).toBe("");
		expect(entries[0]?.done).toBe(false);
	});

	test("parses done entry without body", () => {
		const content = "## [done] [2026-01-01 10:00] 完了済み\n";
		const entries = parseRequest(content);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.done).toBe(true);
		expect(entries[0]?.body).toBe("");
	});
});

describe("getActiveGoal", () => {
	test("returns only active entries", () => {
		const entries = [
			{
				timestamp: "2026-01-01 10:00",
				title: "Active 1",
				body: "Body 1",
				done: false,
			},
			{
				timestamp: "2026-01-01 11:00",
				title: "Done",
				body: "Body 2",
				done: true,
			},
			{
				timestamp: "2026-01-01 12:00",
				title: "Active 2",
				body: "",
				done: false,
			},
		];

		const goal = getActiveGoal(entries);
		expect(goal).toContain("[2026-01-01 10:00] Active 1");
		expect(goal).toContain("Body 1");
		expect(goal).not.toContain("Done");
		expect(goal).toContain("[2026-01-01 12:00] Active 2");
	});

	test("returns empty string when all entries are done", () => {
		const entries = [
			{ timestamp: "2026-01-01 10:00", title: "Done 1", body: "", done: true },
			{ timestamp: "2026-01-01 11:00", title: "Done 2", body: "", done: true },
		];
		expect(getActiveGoal(entries)).toBe("");
	});

	test("returns empty string for empty entries", () => {
		expect(getActiveGoal([])).toBe("");
	});

	test("omits body from output when body is empty", () => {
		const entries = [
			{
				timestamp: "2026-01-01 10:00",
				title: "No Body",
				body: "",
				done: false,
			},
		];
		const goal = getActiveGoal(entries);
		expect(goal).toBe("[2026-01-01 10:00] No Body");
	});
});

describe("formatNewEntry", () => {
	test("generates entry with timestamp, title, and body", () => {
		const entry = formatNewEntry("テスト依頼", "詳細な説明文です。");
		expect(entry).toMatch(/^## \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] テスト依頼$/m);
		expect(entry).toContain("詳細な説明文です。");
	});

	test("generates entry without body", () => {
		const entry = formatNewEntry("タイトルのみ", "");
		expect(entry).toMatch(
			/^## \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] タイトルのみ$/,
		);
		expect(entry).not.toContain("\n\n");
	});
});
