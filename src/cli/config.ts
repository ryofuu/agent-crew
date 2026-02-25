import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import type { Result } from "../kernel/index.js";
import { CLIErrors, err, ok } from "../kernel/index.js";

const ModelIdSchema = z.enum([
	"claude-opus-4-6",
	"claude-sonnet-4-6",
	"codex-1",
	"codex-mini-latest",
]);

const ConfigSchema = z.object({
	project_name: z.string(),
	defaults: z
		.object({
			planner_model: ModelIdSchema.default("claude-opus-4-6"),
			implementer_model: ModelIdSchema.default("codex-1"),
			reviewer_model: ModelIdSchema.default("claude-opus-4-6"),
		})
		.default({}),
	tmux: z
		.object({
			session_prefix: z.string().default("crew"),
		})
		.default({}),
	agent: z
		.object({
			nudge_interval_seconds: z.number().default(300),
			max_escalation_phase: z.number().default(3),
			auto_approve: z.boolean().default(false),
		})
		.default({}),
	workflow: z
		.object({
			poll_interval_seconds: z.number().default(5),
		})
		.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function readConfig(
	crewDir: string,
): Promise<Result<Config, string>> {
	const configPath = path.join(crewDir, "config.yaml");
	try {
		const raw = await fs.promises.readFile(configPath, "utf-8");
		const parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
		const result = ConfigSchema.safeParse(parsed);
		if (!result.success) {
			return err(`${CLIErrors.CONFIG_ERROR}: ${result.error.message}`);
		}
		return ok(result.data);
	} catch {
		return err(`${CLIErrors.CONFIG_ERROR}: config.yaml not found`);
	}
}

export async function writeConfig(
	crewDir: string,
	config: Config,
): Promise<Result<void, string>> {
	const configPath = path.join(crewDir, "config.yaml");
	const tmpPath = `${configPath}.tmp`;
	try {
		const content = yaml.dump(config, { lineWidth: 120 });
		await fs.promises.writeFile(tmpPath, content, "utf-8");
		await fs.promises.rename(tmpPath, configPath);
		return ok(undefined);
	} catch (e) {
		return err(`${CLIErrors.CONFIG_ERROR}: ${e}`);
	}
}

export function defaultConfig(projectName: string): Config {
	return ConfigSchema.parse({ project_name: projectName });
}
