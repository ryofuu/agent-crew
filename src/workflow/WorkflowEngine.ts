import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { Result } from "../kernel/index.js";
import { err, ok, WorkflowErrors } from "../kernel/index.js";
import type { StageDefinition, WorkflowDefinition } from "./schema.js";
import { WorkflowDefinitionSchema } from "./schema.js";
import type { StageState, WorkflowState } from "./state.js";
import { readState, writeState } from "./state.js";
import type { WorkflowEnginePort } from "./types.js";

export class WorkflowEngine implements WorkflowEnginePort {
	private readonly crewDir: string;
	private readonly searchPaths: string[];
	private definition: WorkflowDefinition | null = null;

	constructor(crewDir: string, searchPaths?: string[]) {
		this.crewDir = crewDir;
		this.searchPaths = searchPaths ?? [
			path.join(crewDir, "workflows"),
			path.join(
				process.env.CREW_HOME ?? path.join(process.env.HOME ?? "", ".crew"),
				"workflows",
			),
			path.join(import.meta.dir, "../../templates"),
		];
	}

	async start(
		workflowName: string,
		goal: string,
	): Promise<Result<void, string>> {
		const existing = await readState(this.crewDir);
		if (existing.ok && existing.value.status === "running") {
			return err(WorkflowErrors.ALREADY_RUNNING);
		}

		const defResult = await this.loadDefinition(workflowName);
		if (!defResult.ok) return defResult;
		this.definition = defResult.value;

		const now = new Date().toISOString();
		const state: WorkflowState = {
			workflowName,
			goal,
			status: "running",
			currentStageIndex: 0,
			cycleCount: 1,
			stages: this.definition.stages.map((s) => ({
				name: s.name,
				status: "pending",
			})),
			startedAt: now,
			updatedAt: now,
		};

		// Activate the first stage
		const firstStage = state.stages[0];
		const firstDef = this.definition.stages[0];
		if (!(firstStage && firstDef)) {
			return err(WorkflowErrors.INVALID_DEFINITION);
		}
		firstStage.status = "active";
		if (firstDef.human_gate) {
			firstStage.status = "waiting_gate";
		}

		return writeState(this.crewDir, state);
	}

	async advance(): Promise<Result<void, string>> {
		const stateResult = await this.ensureRunning();
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;

		const defResult = await this.ensureDefinition(state.workflowName);
		if (!defResult.ok) return defResult;
		const def = defResult.value;

		const currentStage = state.stages[state.currentStageIndex];
		if (!currentStage) return err(WorkflowErrors.INVALID_DEFINITION);
		if (currentStage.status === "waiting_gate") {
			return err(WorkflowErrors.GATE_PENDING);
		}

		// Mark current as completed
		currentStage.status = "completed";

		const nextIndex = state.currentStageIndex + 1;
		if (nextIndex < state.stages.length) {
			const nextStage = state.stages[nextIndex];
			const nextDef = def.stages[nextIndex];
			if (!(nextStage && nextDef))
				return err(WorkflowErrors.INVALID_DEFINITION);
			// Move to next stage
			state.currentStageIndex = nextIndex;
			nextStage.status = "active";
			if (nextDef.human_gate) {
				nextStage.status = "waiting_gate";
			}
		} else {
			// All stages complete — evaluate loop or close
			const loopResult = this.evaluateLoopOrClose(state, def);
			if (!loopResult.ok) {
				// Persist error state to disk before returning
				state.updatedAt = new Date().toISOString();
				await writeState(this.crewDir, state);
				return loopResult;
			}
		}

		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	async pause(): Promise<Result<void, string>> {
		const stateResult = await this.ensureRunning();
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		state.status = "paused";
		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	async resume(): Promise<Result<void, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		if (state.status !== "paused") {
			return err(WorkflowErrors.NOT_RUNNING);
		}
		state.status = "running";
		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	async continueWorkflow(): Promise<Result<void, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;

		if (state.status === "running") {
			return err(WorkflowErrors.ALREADY_RUNNING);
		}

		const allCompleted = state.stages.every((s) => s.status === "completed");
		if (allCompleted) {
			return err(WorkflowErrors.WORKFLOW_COMPLETED);
		}

		const defResult = await this.loadDefinition(state.workflowName);
		if (!defResult.ok) return defResult;
		this.definition = defResult.value;

		state.status = "running";
		this.activateResumeStage(state);

		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	/** Activate the appropriate stage for workflow continuation. */
	private activateResumeStage(state: WorkflowState): void {
		if (!this.definition) return;
		const currentStage = state.stages[state.currentStageIndex];
		if (!currentStage) return;

		if (currentStage.status === "completed") {
			this.activateNextPending(state);
		} else if (currentStage.status === "pending") {
			this.activateStageAt(state, state.currentStageIndex);
		}
		// If already "active" or "waiting_gate", keep as-is
	}

	private activateNextPending(state: WorkflowState): void {
		for (let i = state.currentStageIndex + 1; i < state.stages.length; i++) {
			const s = state.stages[i];
			if (s && s.status !== "completed") {
				state.currentStageIndex = i;
				this.activateStageAt(state, i);
				break;
			}
		}
	}

	private activateStageAt(state: WorkflowState, index: number): void {
		if (!this.definition) return;
		const stage = state.stages[index];
		const def = this.definition.stages[index];
		if (!(stage && def)) return;
		stage.status = def.human_gate ? "waiting_gate" : "active";
	}

	async stop(): Promise<Result<void, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		if (state.status !== "running" && state.status !== "paused") {
			return err(WorkflowErrors.NOT_RUNNING);
		}
		state.status = "completed";
		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	async getState(): Promise<Result<WorkflowState, string>> {
		return await readState(this.crewDir);
	}

	async getCurrentStage(): Promise<Result<StageState | null, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		if (state.status !== "running") return ok(null);
		return ok(state.stages[state.currentStageIndex] ?? null);
	}

	async canAdvance(): Promise<Result<boolean, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		if (state.status !== "running") return ok(false);
		const stage = state.stages[state.currentStageIndex];
		if (!stage) return ok(false);
		return ok(stage.status === "active");
	}

	async approveGate(): Promise<Result<void, string>> {
		const stateResult = await this.ensureRunning();
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		const stage = state.stages[state.currentStageIndex];
		if (!stage || stage.status !== "waiting_gate") {
			return err(WorkflowErrors.GATE_PENDING);
		}
		stage.status = "active";
		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	async rejectGate(): Promise<Result<void, string>> {
		const stateResult = await this.ensureRunning();
		if (!stateResult.ok) return stateResult;
		const state = stateResult.value;
		const stage = state.stages[state.currentStageIndex];
		if (!stage || stage.status !== "waiting_gate") {
			return err(WorkflowErrors.GATE_PENDING);
		}
		state.status = "completed";
		state.updatedAt = new Date().toISOString();
		return writeState(this.crewDir, state);
	}

	private evaluateLoopOrClose(
		state: WorkflowState,
		def: WorkflowDefinition,
	): Result<void, string> {
		if (!def.loop_on_changes) {
			state.status = "completed";
			return ok(undefined);
		}

		if (state.cycleCount >= def.max_cycles) {
			state.status = "error";
			return err(WorkflowErrors.MAX_CYCLES_EXCEEDED);
		}

		// Loop: reset all stages and increment cycle
		state.cycleCount++;
		state.currentStageIndex = 0;
		for (const stage of state.stages) {
			stage.status = "pending";
		}
		const loopFirstStage = state.stages[0];
		const loopFirstDef = def.stages[0];
		if (!(loopFirstStage && loopFirstDef))
			return err(WorkflowErrors.INVALID_DEFINITION);
		loopFirstStage.status = "active";
		if (loopFirstDef.human_gate) {
			loopFirstStage.status = "waiting_gate";
		}

		return ok(undefined);
	}

	getStageDefinitions(): Result<StageDefinition[], string> {
		if (!this.definition) return err(WorkflowErrors.NOT_RUNNING);
		return ok(this.definition.stages);
	}

	private async ensureRunning(): Promise<Result<WorkflowState, string>> {
		const stateResult = await readState(this.crewDir);
		if (!stateResult.ok) return stateResult;
		if (stateResult.value.status !== "running") {
			return err(WorkflowErrors.NOT_RUNNING);
		}
		return stateResult;
	}

	private async ensureDefinition(
		workflowName: string,
	): Promise<Result<WorkflowDefinition, string>> {
		if (this.definition) return ok(this.definition);
		const result = await this.loadDefinition(workflowName);
		if (result.ok) this.definition = result.value;
		return result;
	}

	private async loadDefinition(
		workflowName: string,
	): Promise<Result<WorkflowDefinition, string>> {
		if (!/^[a-zA-Z0-9_-]+$/.test(workflowName)) {
			return err(
				`${WorkflowErrors.INVALID_DEFINITION}: invalid workflow name: ${workflowName}`,
			);
		}
		for (const dir of this.searchPaths) {
			const filePath = path.join(dir, `${workflowName}.yaml`);
			try {
				const raw = await fs.promises.readFile(filePath, "utf-8");
				const parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
				const validated = WorkflowDefinitionSchema.safeParse(parsed);
				if (validated.success) {
					return ok(validated.data);
				}
				return err(
					`${WorkflowErrors.INVALID_DEFINITION}: ${validated.error.message}`,
				);
			} catch {
				// file not found in this search path, try next
			}
		}
		return err(`${WorkflowErrors.WORKFLOW_NOT_FOUND}: ${workflowName}`);
	}
}
