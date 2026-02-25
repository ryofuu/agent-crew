import * as fs from "node:fs";
import * as path from "node:path";

export const DEV_CYCLE_YAML = `name: dev-cycle
description: "Plan → Implement → Review → loop"
loop_on_changes: true
max_cycles: 10
stages:
  - name: plan
    role: planner
    provider: claude-code
    human_gate: true
    context_reset: false
  - name: implement
    role: implementer
    provider: codex
    human_gate: false
    context_reset: true
  - name: review
    role: reviewer
    provider: claude-code
    human_gate: true
    context_reset: true
    on_complete: [loop, close]
`;

export const SIMPLE_FLOW_YAML = `name: simple-flow
description: "Simple non-looping flow for tests"
loop_on_changes: false
max_cycles: 1
stages:
  - name: plan
    role: planner
    provider: claude-code
    human_gate: false
  - name: implement
    role: implementer
    provider: codex
    human_gate: false
  - name: review
    role: reviewer
    provider: claude-code
    human_gate: false
`;

export async function setupWorkflowFixtures(crewDir: string): Promise<void> {
	const workflowsDir = path.join(crewDir, "workflows");
	await fs.promises.mkdir(workflowsDir, { recursive: true });
	await fs.promises.writeFile(
		path.join(workflowsDir, "dev-cycle.yaml"),
		DEV_CYCLE_YAML,
		"utf-8",
	);
	await fs.promises.writeFile(
		path.join(workflowsDir, "simple-flow.yaml"),
		SIMPLE_FLOW_YAML,
		"utf-8",
	);
}
