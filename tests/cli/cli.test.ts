import { describe, expect, test } from "bun:test";
import { createCLI } from "../../src/cli/index.js";

describe("CLI", () => {
	test("createCLI returns a commander program", () => {
		const program = createCLI();
		expect(program.name()).toBe("crew");
	});

	test("has all expected commands", () => {
		const program = createCLI();
		const commandNames = program.commands.map((c) => c.name());
		expect(commandNames).toContain("init");
		expect(commandNames).toContain("start");
		expect(commandNames).toContain("status");
		expect(commandNames).toContain("stop");
		expect(commandNames).toContain("list");
		expect(commandNames).toContain("doctor");
	});
});
