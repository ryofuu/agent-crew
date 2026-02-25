import * as fs from "node:fs";
import * as path from "node:path";

export async function listCommand(): Promise<void> {
	const cwd = process.cwd();
	const searchPaths = [
		path.join(cwd, ".crew", "workflows"),
		path.join(process.env.CREW_HOME ?? path.join(process.env.HOME ?? "", ".crew"), "workflows"),
		path.join(import.meta.dir, "../../../templates"),
	];

	console.log("Available workflows:");
	let found = false;

	for (const dir of searchPaths) {
		try {
			const files = await fs.promises.readdir(dir);
			const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
			for (const file of yamlFiles) {
				const name = file.replace(/\.ya?ml$/, "");
				const source = dir.includes(".crew/workflows")
					? "project"
					: dir.includes("templates")
						? "builtin"
						: "user";
				console.log(`  ${name}  (${source})`);
				found = true;
			}
		} catch {
			// directory doesn't exist
		}
	}

	if (!found) {
		console.log("  (none found)");
	}
}
