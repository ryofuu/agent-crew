import { describe, expect, test } from "bun:test";
import {
	AgentErrors,
	CLIErrors,
	TaskStoreErrors,
	WorkflowErrors,
} from "../../src/kernel/errors.js";

describe("Error constants", () => {
	test("WorkflowErrors has all expected keys", () => {
		expect(WorkflowErrors.WORKFLOW_NOT_FOUND).toBe("WORKFLOW_NOT_FOUND");
		expect(WorkflowErrors.INVALID_DEFINITION).toBe("INVALID_DEFINITION");
		expect(WorkflowErrors.MAX_CYCLES_EXCEEDED).toBe("MAX_CYCLES_EXCEEDED");
		expect(WorkflowErrors.GATE_PENDING).toBe("GATE_PENDING");
		expect(WorkflowErrors.ALREADY_RUNNING).toBe("ALREADY_RUNNING");
		expect(WorkflowErrors.NOT_RUNNING).toBe("NOT_RUNNING");
	});

	test("AgentErrors has all expected keys", () => {
		expect(AgentErrors.SPAWN_FAILED).toBe("SPAWN_FAILED");
		expect(AgentErrors.AGENT_NOT_FOUND).toBe("AGENT_NOT_FOUND");
		expect(AgentErrors.TMUX_ERROR).toBe("TMUX_ERROR");
		expect(AgentErrors.NUDGE_FAILED).toBe("NUDGE_FAILED");
		expect(AgentErrors.SESSION_EXISTS).toBe("SESSION_EXISTS");
	});

	test("TaskStoreErrors has all expected keys", () => {
		expect(TaskStoreErrors.TASK_NOT_FOUND).toBe("TASK_NOT_FOUND");
		expect(TaskStoreErrors.INVALID_TRANSITION).toBe("INVALID_TRANSITION");
		expect(TaskStoreErrors.WRITE_FAILED).toBe("WRITE_FAILED");
		expect(TaskStoreErrors.PARSE_ERROR).toBe("PARSE_ERROR");
		expect(TaskStoreErrors.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
	});

	test("CLIErrors has all expected keys", () => {
		expect(CLIErrors.NOT_INITIALIZED).toBe("NOT_INITIALIZED");
		expect(CLIErrors.CONFIG_ERROR).toBe("CONFIG_ERROR");
	});
});
