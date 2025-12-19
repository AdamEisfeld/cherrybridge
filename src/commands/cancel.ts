import { Command } from "commander";
import {
	ensureGitRepo,
	abortCherryPick,
	ensureCleanWorkingTree,
	getCurrentBranch,
	removeBranchCherrybridgeConfig
} from "../git.js";

export function cancelCommand(): Command {
	const cmd = new Command("cancel")
		.description("Abort an in-progress cherry-pick.")
		.action(async () => {
			ensureGitRepo();
			await ensureCleanWorkingTree(false); // allow dirty since we might be in conflict state
			await abortCherryPick();

			// Remove config for current branch to clean up
			const currentBranch = await getCurrentBranch();
			await removeBranchCherrybridgeConfig(currentBranch);

			console.log(`🧹 Cancelled cherry-pick and removed config.`);
		});

	return cmd;
}
