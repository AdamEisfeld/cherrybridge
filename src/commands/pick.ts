import { Command } from "commander";
import { ensureGhInstalled, listMergedPRsByLabel } from "../gh.js";
import {
	ensureGitRepo,
	getCurrentBranch,
	ensureCleanWorkingTree,
	fetchAll,
	checkoutNewBranchFrom,
	cherryPickMergeCommit,
	isCommitAlreadyPickedByX,
	abortCherryPickIfInProgress
} from "../git.js";
import { chooseBranchesAndLabel } from "../prompts.js";
import { loadSession, saveSession, ensureSessionDir } from "../session.js";
import type { Session } from "../types.js";

// Shared behavior with `continue`
export async function applyPendingCherryPicks(label: string): Promise<void> {
	const session = await loadSession(label);
	if (!session) {
		throw new Error(`No session found for label "${label}". Run "cherrybridge pick" first.`);
	}

	await ensureCleanWorkingTree();
	await abortCherryPickIfInProgress(); // optional safety: refuses if mid-cherry-pick

	// Recompute pending by scanning for -x lines
	const pending = [];
	for (const pr of session.prs) {
		const already = await isCommitAlreadyPickedByX(pr.mergeCommitSha);
		if (!already) pending.push(pr);
	}

	if (pending.length === 0) {
		console.log(`✅ Nothing to pick. All PR merge commits for "${label}" appear to be applied.`);
		return;
	}

	console.log(`Found ${pending.length} pending PR(s) to cherry-pick onto ${session.promotionBranch}:`);
	for (const pr of pending) {
		console.log(`- #${pr.number} ${pr.title} (${pr.mergeCommitSha.slice(0, 8)})`);
	}

	for (const pr of pending) {
		console.log(`\n🍒 Cherry-picking PR #${pr.number}: ${pr.mergeCommitSha}`);
		const ok = await cherryPickMergeCommit(pr.mergeCommitSha);

		if (!ok) {
			console.log(
				`\n⚠️ Conflict encountered on ${pr.mergeCommitSha}.\n` +
					`Resolve conflicts, then run:\n` +
					`  cherrybridge continue\n\n` +
					`Or to abort:\n` +
					`  cherrybridge cancel\n`
			);
			return;
		}
	}

	console.log(`\n✅ Done. You can now push and open a PR into "${session.toBranch}".`);
	console.log(
		`Suggested:\n  git push -u origin ${session.promotionBranch}\n  gh pr create --base ${session.toBranch} --head ${session.promotionBranch}\n`
	);
}

export function pickCommand(): Command {
	const cmd = new Command("pick")
		.description("Interactively pick merged PR merge commits (by label) onto a target branch.")
		.option("--from <branch>", "Source base branch PRs were merged into (default: development)")
		.option("--to <branch>", "Target base branch to promote into (default: staging)")
		.option("--label <label>", "Label used to group PRs (e.g. feature:ABC-123)")
		.option("--branch <name>", "Promotion branch name (default: promote/<label-sanitized>)")
		.action(
			async (opts: { from?: string; to?: string; label?: string; branch?: string }) => {
				ensureGitRepo();
				await ensureGhInstalled();
				await ensureCleanWorkingTree();

				const answers = await chooseBranchesAndLabel({
					from: opts.from ?? "development",
					to: opts.to ?? "staging",
					label: opts.label
				});

				const fromBranch = answers.from;
				const toBranch = answers.to;
				const label = answers.label;
				const promotionBranch =
					opts.branch ?? `promote/${label.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;

				await fetchAll();

				// Create/ensure session folder
				await ensureSessionDir(label);

				// (Re)load session if it exists, else create a new one
				const existingSession = await loadSession(label);
				const session: Session =
					existingSession ??
					{
						label,
						fromBranch,
						toBranch,
						promotionBranch,
						lastSyncedAt: null,
						prs: [],
						createdFromBranch: await getCurrentBranch()
					};

				// Always resync PR list before doing anything.
				const prs = await listMergedPRsByLabel({ base: fromBranch, label });
				session.prs = prs;
				session.fromBranch = fromBranch;
				session.toBranch = toBranch;
				session.promotionBranch = promotionBranch;
				session.lastSyncedAt = new Date().toISOString();
				await saveSession(label, session);

				// Create promotion branch from target base
				await checkoutNewBranchFrom(promotionBranch, toBranch);

				await applyPendingCherryPicks(label);
			}
		);

	return cmd;
}

