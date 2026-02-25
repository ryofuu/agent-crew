import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { Result, WorkflowStatus } from "../kernel/index.js";
import { err, ok } from "../kernel/index.js";

export type StageStatus = "pending" | "active" | "waiting_gate" | "completed";

export interface StageState {
	name: string;
	status: StageStatus;
}

export interface WorkflowState {
	workflowName: string;
	goal: string;
	status: WorkflowStatus;
	currentStageIndex: number;
	cycleCount: number;
	stages: StageState[];
	startedAt: string;
	updatedAt: string;
}

const WorkflowStateSchema = z.object({
	workflowName: z.string(),
	goal: z.string(),
	status: z.enum(["idle", "running", "paused", "completed", "error"]),
	currentStageIndex: z.number(),
	cycleCount: z.number(),
	stages: z.array(
		z.object({
			name: z.string(),
			status: z.enum(["pending", "active", "waiting_gate", "completed"]),
		}),
	),
	startedAt: z.string(),
	updatedAt: z.string(),
});

export async function readState(
	crewDir: string,
): Promise<Result<WorkflowState, string>> {
	const statePath = path.join(crewDir, "state.json");
	try {
		const raw = await fs.promises.readFile(statePath, "utf-8");
		const parsed = WorkflowStateSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			return err(`Invalid state file: ${parsed.error.message}`);
		}
		return ok(parsed.data);
	} catch {
		return err("State file not found or invalid");
	}
}

export async function writeState(
	crewDir: string,
	state: WorkflowState,
): Promise<Result<void, string>> {
	const statePath = path.join(crewDir, "state.json");
	const tmpPath = `${statePath}.tmp`;
	try {
		await fs.promises.mkdir(crewDir, { recursive: true });
		await fs.promises.writeFile(
			tmpPath,
			JSON.stringify(state, null, 2),
			"utf-8",
		);
		await fs.promises.rename(tmpPath, statePath);
		return ok(undefined);
	} catch (e) {
		return err(`Failed to write state: ${e}`);
	}
}
