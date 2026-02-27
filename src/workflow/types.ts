import type { Result } from "../kernel/index.js";
import type { StageDefinition } from "./schema.js";
import type { StageState, WorkflowState } from "./state.js";

export interface WorkflowEnginePort {
	start(workflowName: string, goal: string): Promise<Result<void, string>>;
	advance(): Promise<Result<void, string>>;
	pause(): Promise<Result<void, string>>;
	resume(): Promise<Result<void, string>>;
	stop(): Promise<Result<void, string>>;
	continueWorkflow(): Promise<Result<void, string>>;
	getState(): Promise<Result<WorkflowState, string>>;
	getCurrentStage(): Promise<Result<StageState | null, string>>;
	canAdvance(): Promise<Result<boolean, string>>;
	approveGate(): Promise<Result<void, string>>;
	rejectGate(): Promise<Result<void, string>>;
	getStageDefinitions(): Result<StageDefinition[], string>;
}
