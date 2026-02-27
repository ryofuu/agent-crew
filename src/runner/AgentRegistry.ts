import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { Result } from "../kernel/index.js";
import { err, ok } from "../kernel/index.js";

const AgentRecordSchema = z.object({
	name: z.string(),
	role: z.string(),
	pane: z.string(),
	cliType: z.enum(["claude-code", "codex"]),
	model: z.string().optional(),
	shellPid: z.number(),
	agentPid: z.number().optional(),
	spawnedAt: z.string(),
	respawnCount: z.number().default(0),
});

const AgentRegistrySchema = z.object({
	sessionName: z.string(),
	agents: z.array(AgentRecordSchema),
	updatedAt: z.string(),
});

export type AgentRecord = z.infer<typeof AgentRecordSchema>;
export type AgentRegistryData = z.infer<typeof AgentRegistrySchema>;

export interface AgentRegistryPort {
	load(crewDir: string): Promise<Result<AgentRegistryData, string>>;
	save(crewDir: string, data: AgentRegistryData): Promise<Result<void, string>>;
}

export class AgentRegistry implements AgentRegistryPort {
	private registryPath(crewDir: string): string {
		return path.join(crewDir, "agents.json");
	}

	async load(crewDir: string): Promise<Result<AgentRegistryData, string>> {
		try {
			const raw = await fs.promises.readFile(
				this.registryPath(crewDir),
				"utf-8",
			);
			const parsed = JSON.parse(raw);
			const result = AgentRegistrySchema.safeParse(parsed);
			if (!result.success) {
				return err(`agents.json validation failed: ${result.error.message}`);
			}
			return ok(result.data);
		} catch (e) {
			return err(`agents.json read failed: ${e}`);
		}
	}

	async save(
		crewDir: string,
		data: AgentRegistryData,
	): Promise<Result<void, string>> {
		const filePath = this.registryPath(crewDir);
		const tmpPath = `${filePath}.tmp`;
		try {
			const content = JSON.stringify(
				{ ...data, updatedAt: new Date().toISOString() },
				null,
				2,
			);
			await fs.promises.writeFile(tmpPath, content, "utf-8");
			await fs.promises.rename(tmpPath, filePath);
			return ok(undefined);
		} catch (e) {
			return err(`agents.json write failed: ${e}`);
		}
	}
}
