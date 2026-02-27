import { describe, expect, test } from "bun:test";
import type { Result } from "../../src/kernel/index.js";
import { ok } from "../../src/kernel/index.js";
import type { ProcessProbePort } from "../../src/runner/ProcessProbe.js";
import { ProcessProbe } from "../../src/runner/ProcessProbe.js";

describe("ProcessProbe", () => {
	describe("isAlive", () => {
		test("returns true for current process", () => {
			const probe = new ProcessProbe();
			expect(probe.isAlive(process.pid)).toBe(true);
		});

		test("returns false for non-existent PID", () => {
			const probe = new ProcessProbe();
			// PID 99999999 is extremely unlikely to exist
			expect(probe.isAlive(99999999)).toBe(false);
		});
	});

	describe("getChildPids", () => {
		test("returns array for current process", async () => {
			const probe = new ProcessProbe();
			const result = await probe.getChildPids(process.pid);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(Array.isArray(result.value)).toBe(true);
			}
		});

		test("returns empty array for process with no children", async () => {
			const probe = new ProcessProbe();
			// PID 99999999 won't have children
			const result = await probe.getChildPids(99999999);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe("MockProcessProbe", () => {
		test("can be used as a mock", () => {
			const mock: ProcessProbePort = {
				getChildPids: (_pid: number): Promise<Result<number[], string>> =>
					Promise.resolve(ok([100, 200])),
				isAlive: (_pid: number): boolean => true,
			};

			expect(mock.isAlive(1)).toBe(true);
		});
	});
});
