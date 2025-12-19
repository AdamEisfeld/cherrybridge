import { Command } from "commander";
import { ensureGhInstalled, listMergedPRsByLabel } from "../gh.js";
import {
	ensureGitRepo,
	ensureCleanWorkingTree,
	fetchAll,
	continueCherryPickIfInProgress
} from "../git.js";
import { pickSessionLabelIfNeeded } from "../prompts.js";
import { listSessionLabels, loadSession, saveSession } from "../session.js";
import { applyPendingCherryPicks } from "./pick.js";
import { run } from "../utils.js";

export function continueCommand(): Command {
	const cmd = new Command("continue")
		.description("Continue an in-progress cherry-pick, then pick any newly-merged PRs for the session label.")
		.option("--label <label>", "Label session to continue")
		.action(async (opts: { label?: string }) => {
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

			const labels = await listSessionLabels();
			if (labels.length === 0) {
				throw new Error(`No sessions found. Run "cherrybridge pick" first.`);
			}

			const label =
				opts.label ??
				(labels.length === 1 ? labels[0] : await pickSessionLabelIfNeeded(labels));

			const session = await loadSession(label);
			if (!session) {
				throw new Error(`No session found for label "${label}".`);
			}

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

			// Always refresh PR list each continue run
			const prs = await listMergedPRsByLabel({ base: session.fromBranch, label });
			session.prs = prs;
			session.lastSyncedAt = new Date().toISOString();
			await saveSession(label, session);

			await applyPendingCherryPicks(label);
		});

	return cmd;
}

