import { Command } from "commander";
import { ensureGhInstalled, listMergedPRsByLabel } from "../gh.js";
import { ensureGitRepo, isCommitAlreadyPickedByX, getCurrentBranch } from "../git.js";
import { promptForMissingValues, promptForVia } from "../prompts.js";

export function statusCommand(): Command {
	const cmd = new Command("status")
		.description("Show what cherrybridge thinks is pending.")
		.option("--from <branch>", "Source base branch PRs were merged into")
		.option("--to <branch>", "Target base branch to promote into")
		.option("--label <label>", "Label used to group PRs")
		.option("--via <branch>", "Branch to check status for (defaults to current branch)")
		.action(async (opts: { from?: string; to?: string; label?: string; via?: string }) => {
			ensureGitRepo();
			await ensureGhInstalled();

			const { from, to, label } = await promptForMissingValues({
				from: opts.from,
				to: opts.to,
				label: opts.label
			});

			// Prompt for via if not provided, defaulting to current branch
			const currentBranch = await getCurrentBranch();
			const promotionBranch = opts.via ?? (await promptForVia(label, currentBranch, from, to));

			// Fetch PR list
			const prs = await listMergedPRsByLabel({ base: from, label });

			const pending = [];
			for (const pr of prs) {
				const already = await isCommitAlreadyPickedByX(pr.mergeCommitSha);
				if (!already) pending.push(pr);
			}

			console.log(`Session: ${label}`);
			console.log(`From: ${from} → To: ${to}`);
			console.log(`Promotion branch: ${promotionBranch}`);
			console.log(`PRs found: ${prs.length}`);
			console.log(`Pending: ${pending.length}`);

			if (pending.length > 0) {
				console.log("\nPending PRs:");
				for (const pr of pending) {
					console.log(`- #${pr.number} ${pr.title} (${pr.mergeCommitSha.slice(0, 8)})`);
				}
			}
		});

	return cmd;
}
