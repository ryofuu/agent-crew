export async function doctorCommand(): Promise<void> {
	console.log("Checking prerequisites...\n");

	const checks = [
		{ name: "bun", cmd: ["bun", "--version"], minVersion: "1.2" },
		{ name: "tmux", cmd: ["tmux", "-V"], minVersion: "3.3" },
		{ name: "claude", cmd: ["claude", "--version"], minVersion: null },
		{ name: "codex", cmd: ["codex", "--version"], minVersion: null },
	];

	let allOk = true;

	for (const check of checks) {
		try {
			const proc = Bun.spawn(check.cmd, { stdout: "pipe", stderr: "pipe" });
			const stdout = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;

			if (exitCode === 0) {
				const version = stdout.trim().split("\n")[0];
				console.log(`  [OK] ${check.name}: ${version}`);
			} else {
				console.log(`  [FAIL] ${check.name}: not found or error`);
				allOk = false;
			}
		} catch {
			console.log(`  [FAIL] ${check.name}: not found`);
			allOk = false;
		}
	}

	console.log();
	if (allOk) {
		console.log("All checks passed.");
	} else {
		console.log("Some checks failed. Install missing tools before running crew.");
	}
}
