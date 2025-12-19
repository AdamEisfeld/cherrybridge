import { Command } from "commander";
import { pickCommand } from "./commands/pick.js";
import { continueCommand } from "./commands/continue.js";
import { cancelCommand } from "./commands/cancel.js";
import { statusCommand } from "./commands/status.js";

export async function runCLI(): Promise<void> {
	const program = new Command();

	program
		.name("cherrybridge")
		.description("Promote merged PRs by label via cherry-picking PR merge commits.")
		.version("0.1.0");

	program.addCommand(pickCommand());
	program.addCommand(continueCommand());
	program.addCommand(cancelCommand());
	program.addCommand(statusCommand());

	await program.parseAsync(process.argv);
}


