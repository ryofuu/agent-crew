import * as fs from "node:fs";
import * as path from "node:path";
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

export async function readState(crewDir: string): Promise<Result<WorkflowState, string>> {
	const statePath = path.join(crewDir, "state.json");
	try {
		const raw = await fs.promises.readFile(statePath, "utf-8");
		return ok(JSON.parse(raw) as WorkflowState);
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
		await fs.promises.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8");
		await fs.promises.rename(tmpPath, statePath);
		return ok(undefined);
	} catch (e) {
		return err(`Failed to write state: ${e}`);
	}
}
