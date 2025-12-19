import { spawn } from "node:child_process";

export async function run(
	cmd: string,
	args: string[],
	opts?: { cwd?: string; stdio?: "inherit" | "pipe" }
): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: opts?.cwd,
			stdio: opts?.stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"]
		});

		let stdout = "";
		let stderr = "";

		if (child.stdout) child.stdout.on("data", (d) => (stdout += String(d)));
		if (child.stderr) child.stderr.on("data", (d) => (stderr += String(d)));

		// Handle spawn errors (e.g., command not found)
		child.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "ENOENT") {
				resolve({
					code: 127,
					stdout: "",
					stderr: `Command not found: ${cmd}. ${err.message}`
				});
			} else {
				resolve({
					code: 1,
					stdout: "",
					stderr: err.message || String(err)
				});
			}
		});

		child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
	});
}

