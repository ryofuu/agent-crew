import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { WorkflowDefinitionSchema } from "../../src/workflow/schema.js";

describe("dev-cycle.yaml schema validation", () => {
	test("dev-cycle.yaml passes Zod validation", async () => {
		const templatePath = path.join(
			import.meta.dir,
			"../../templates/dev-cycle.yaml",
		);
		const raw = await fs.promises.readFile(templatePath, "utf-8");
		const parsed = yaml.load(raw);
		const result = WorkflowDefinitionSchema.safeParse(parsed);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("dev-cycle");
			expect(result.data.stages.length).toBe(3);
			expect(result.data.loop_on_changes).toBe(true);
			expect(result.data.max_cycles).toBe(10);
		}
	});
});

describe("simple-flow.yaml schema validation", () => {
	test("simple-flow.yaml passes Zod validation", async () => {
		const templatePath = path.join(
			import.meta.dir,
			"../../templates/simple-flow.yaml",
		);
		const raw = await fs.promises.readFile(templatePath, "utf-8");
		const parsed = yaml.load(raw);
		const result = WorkflowDefinitionSchema.safeParse(parsed);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("simple-flow");
			expect(result.data.stages.length).toBe(3);
			expect(result.data.loop_on_changes).toBe(false);
			expect(result.data.max_cycles).toBe(1);
		}
	});
});
