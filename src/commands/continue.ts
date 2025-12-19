import { Command } from "commander";
import { ensureGhInstalled } from "../gh.js";
import {
	ensureGitRepo,
	ensureCleanWorkingTree,
	fetchAll,
	continueCherryPickIfInProgress,
	getCurrentBranch
} from "../git.js";
import { promptForMissingValues, promptForVia } from "../prompts.js";
import { applyPendingCherryPicks } from "./pick.js";
import { run } from "../utils.js";

export function continueCommand(): Command {
	const cmd = new Command("continue")
		.description("Continue an in-progress cherry-pick, then pick any newly-merged PRs.")
		.option("--from <branch>", "Source base branch PRs were merged into")
		.option("--to <branch>", "Target base branch to promote into")
		.option("--label <label>", "Label used to group PRs")
		.option("--via <branch>", "Branch to use for promotion (defaults to current branch)")
		.action(async (opts: { from?: string; to?: string; label?: string; via?: string }) => {
			ensureGitRepo();
			await ensureGhInstalled();

			// Check if we're in a cherry-pick state first
			const cherryPickHead = await run("git", ["rev-parse", "--verify", "CHERRY_PICK_HEAD"]);
			const isInCherryPick = cherryPickHead.code === 0;

			// Only require clean working tree if we're not continuing a cherry-pick
			if (!isInCherryPick) {
				await ensureCleanWorkingTree();
			}

			await fetchAll();

			const { from, to, label } = await promptForMissingValues({
				from: opts.from,
				to: opts.to,
				label: opts.label
			});

			// Prompt for via if not provided, defaulting to current branch
			const currentBranch = await getCurrentBranch();
			const promotionBranch = opts.via ?? (await promptForVia(label, currentBranch));

			// If user is mid-cherry-pick conflict resolution, allow git to continue first.
			const continued = await continueCherryPickIfInProgress();
			if (continued) {
				// Check if cherry-pick actually succeeded by checking if CHERRY_PICK_HEAD still exists
				const stillInProgress = await run("git", ["rev-parse", "--verify", "CHERRY_PICK_HEAD"]);
				if (stillInProgress.code === 0) {
					// Still in conflict state, exit early
					console.log("\n⚠️ Cherry-pick is still in conflict. Resolve conflicts and run cherrybridge continue again.");
					return;
				}
				console.log("✅ Continued cherry-pick.");
			}

			await applyPendingCherryPicks(label, from, to, promotionBranch);
		});

	return cmd;
}
