import * as path from "node:path";
import { AgentRunner, Tmux } from "../../runner/index.js";
import { WorkflowEngine } from "../../workflow/index.js";
import { readConfig } from "../config.js";
import {
	buildAgentList,
	CrewLogger,
	cleanSignalsDir,
	pollLoop,
	type RunOptions,
	recordAllPids,
	sendFirstPrompt,
	spawnAgents,
} from "./_shared.js";

export async function continueCommand(options?: RunOptions): Promise<void> {
	const cwd = process.cwd();
	const crewDir = path.join(cwd, ".crew");

	const configResult = await readConfig();
	if (!configResult.ok) {
		console.error(`Error: ${configResult.error}`);
		console.error("Run 'crew init' first.");
		process.exit(1);
	}
	const config = configResult.value;
	const projectName = path.basename(cwd);

	const engine = new WorkflowEngine(crewDir);
	const tmux = new Tmux();
	const runner = new AgentRunner(tmux, crewDir, cwd);

	const continueResult = await engine.continueWorkflow();
	if (!continueResult.ok) {
		console.error(`Error: ${continueResult.error}`);
		process.exit(1);
	}

	const stateResult = await engine.getState();
	if (!stateResult.ok) {
		console.error(`Error: ${stateResult.error}`);
		process.exit(1);
	}
	const state = stateResult.value;

	const stageDefsResult = engine.getStageDefinitions();
	if (!stageDefsResult.ok) {
		console.error(`Error: ${stageDefsResult.error}`);
		process.exit(1);
	}
	const stageDefs = stageDefsResult.value;
	const agents = buildAgentList(stageDefs);

	const sessionResult = await runner.createSession(projectName);
	if (!sessionResult.ok) {
		console.error(`Error: ${sessionResult.error}`);
		process.exit(1);
	}

	await cleanSignalsDir(crewDir);
	await runner.setupLayout(agents.length);

	const autoApprove = options?.autoApprove || config.agent.auto_approve;
	await spawnAgents(runner, agents, autoApprove);

	// Wait briefly for CLIs to start, then record PIDs
	await Bun.sleep(2000);
	await recordAllPids(runner, agents);

	// ログファイル初期化
	const logger = new CrewLogger(crewDir);
	await logger.open();

	const currentStageIndex = state.currentStageIndex;
	logger.log(
		`Workflow '${state.workflowName}' continued from stage ${currentStageIndex + 1}/${stageDefs.length} (${stageDefs[currentStageIndex]?.name ?? "unknown"})`,
	);
	logger.log(`tmux session: crew-${projectName}`);
	logger.log(`Log file: ${logger.getPath()}`);

	const promptedStageIndex = await sendFirstPrompt(
		engine,
		runner,
		stageDefs,
		state.workflowName,
		crewDir,
	);

	const abortController = new AbortController();
	const cleanup = async () => {
		logger.log("Shutting down...");
		logger.close();
		abortController.abort();
		await runner.destroySession();
		await engine.stop();
		process.exit(0);
	};
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);

	const pollInterval = config.workflow.poll_interval_seconds * 1000;
	const nudgeIntervalSeconds =
		options?.nudgeInterval ?? config.agent.nudge_interval_seconds;
	const nudgeIntervalMs = nudgeIntervalSeconds * 1000;
	const maxNudges = config.agent.max_escalation_phase;
	const maxRespawns = config.agent.max_respawns;
	await pollLoop(
		logger,
		engine,
		runner,
		crewDir,
		stageDefs,
		state.workflowName,
		promptedStageIndex,
		pollInterval,
		nudgeIntervalMs,
		maxNudges,
		maxRespawns,
		abortController.signal,
	);

	logger.close();
	const keepSession = options?.keepSession || config.tmux.keep_session;
	if (keepSession) {
		console.log(
			`Workflow completed. tmux session kept alive: ${runner.getSessionName()}`,
		);
		console.log("Run 'crew stop' to remove the session.");
	} else {
		await runner.destroySession();
	}
}
