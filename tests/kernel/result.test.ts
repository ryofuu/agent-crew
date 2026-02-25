import { describe, expect, test } from "bun:test";
import type { Result } from "../../src/kernel/result.js";
import { err, isErr, isOk, ok } from "../../src/kernel/result.js";

describe("Result", () => {
	test("ok() creates a success result", () => {
		const result = ok(42);
		expect(result.ok).toBe(true);
		expect(result).toEqual({ ok: true, value: 42 });
	});

	test("err() creates a failure result", () => {
		const result = err("something went wrong");
		expect(result.ok).toBe(false);
		expect(result).toEqual({ ok: false, error: "something went wrong" });
	});

	test("isOk() returns true for ok result", () => {
		const result: Result<number> = ok(1);
		expect(isOk(result)).toBe(true);
		expect(isErr(result)).toBe(false);
	});

	test("isErr() returns true for err result", () => {
		const result: Result<number> = err("fail");
		expect(isErr(result)).toBe(true);
		expect(isOk(result)).toBe(false);
	});

	test("type narrowing with isOk", () => {
		const result: Result<string> = ok("hello");
		if (isOk(result)) {
			expect(result.value).toBe("hello");
		}
	});

	test("type narrowing with isErr", () => {
		const result: Result<string> = err("bad");
		if (isErr(result)) {
			expect(result.error).toBe("bad");
		}
	});
});
