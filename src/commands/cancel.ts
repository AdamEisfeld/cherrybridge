import { Command } from "commander";
import { ensureGitRepo, abortCherryPick, ensureCleanWorkingTree } from "../git.js";

export function cancelCommand(): Command {
	const cmd = new Command("cancel")
		.description("Abort an in-progress cherry-pick.")
		.action(async () => {
			ensureGitRepo();
			await ensureCleanWorkingTree(false); // allow dirty since we might be in conflict state
			await abortCherryPick();
			console.log(`🧹 Cancelled cherry-pick.`);
		});

	return cmd;
}
