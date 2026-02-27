import { describe, expect, test } from "bun:test";
import { isValidTransition } from "../../src/store/transitions.js";

describe("isValidTransition", () => {
	test("todo → ready is valid", () => {
		expect(isValidTransition("todo", "ready")).toBe(true);
	});

	test("todo → in_progress is invalid", () => {
		expect(isValidTransition("todo", "in_progress")).toBe(false);
	});

	test("todo → dev_done is invalid", () => {
		expect(isValidTransition("todo", "dev_done")).toBe(false);
	});

	test("ready → in_progress is valid", () => {
		expect(isValidTransition("ready", "in_progress")).toBe(true);
	});

	test("in_progress → dev_done is valid", () => {
		expect(isValidTransition("in_progress", "dev_done")).toBe(true);
	});

	test("in_progress → blocked is valid", () => {
		expect(isValidTransition("in_progress", "blocked")).toBe(true);
	});

	test("dev_done → in_review is valid", () => {
		expect(isValidTransition("dev_done", "in_review")).toBe(true);
	});

	test("in_review → closed is valid", () => {
		expect(isValidTransition("in_review", "closed")).toBe(true);
	});

	test("in_review → changes_requested is valid", () => {
		expect(isValidTransition("in_review", "changes_requested")).toBe(true);
	});

	test("changes_requested → in_progress is valid", () => {
		expect(isValidTransition("changes_requested", "in_progress")).toBe(true);
	});

	test("blocked → in_progress is valid", () => {
		expect(isValidTransition("blocked", "in_progress")).toBe(true);
	});

	test("closed → any is invalid", () => {
		expect(isValidTransition("closed", "todo")).toBe(false);
		expect(isValidTransition("closed", "in_progress")).toBe(false);
	});
});
