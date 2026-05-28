import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { pickCommand } from "./commands/pick.js";
import { continueCommand } from "./commands/continue.js";
import { cancelCommand } from "./commands/cancel.js";
import { prCommand } from "./commands/pr.js";
import { statusCommand } from "./commands/status.js";
import { ticketsCommand } from "./commands/tickets.js";
import { labelCommand } from "./commands/label.js";
import { configCommand } from "./commands/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "../package.json"), "utf-8")
) as { version: string };

export async function runCLI(): Promise<void> {
	const program = new Command();

	program
		.name("cherrybridge")
		.description("Promote merged PRs by label via cherry-picking PR merge commits.")
		.version(packageJson.version);

	program.addCommand(pickCommand());
	program.addCommand(continueCommand());
	program.addCommand(cancelCommand());
	program.addCommand(prCommand());
	program.addCommand(statusCommand());
	program.addCommand(ticketsCommand());
	program.addCommand(labelCommand());
	program.addCommand(configCommand());

	await program.parseAsync(process.argv);
}



