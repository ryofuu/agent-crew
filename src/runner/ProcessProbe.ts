import type { Result } from "../kernel/index.js";
import { err, ok } from "../kernel/index.js";

export interface ProcessProbePort {
	getChildPids(parentPid: number): Promise<Result<number[], string>>;
	isAlive(pid: number): boolean;
}

export class ProcessProbe implements ProcessProbePort {
	async getChildPids(parentPid: number): Promise<Result<number[], string>> {
		try {
			const proc = Bun.spawn(["pgrep", "-P", String(parentPid)], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdout = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;
			if (exitCode !== 0) {
				// pgrep exits 1 when no processes found — that's not an error
				return ok([]);
			}
			const pids = stdout
				.trim()
				.split("\n")
				.filter((l) => l.trim())
				.map((l) => Number.parseInt(l.trim(), 10))
				.filter((n) => !Number.isNaN(n));
			return ok(pids);
		} catch (e) {
			return err(`pgrep failed: ${e}`);
		}
	}

	isAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}
}
