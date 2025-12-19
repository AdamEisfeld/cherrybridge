import { Command } from "commander";
import { ensureGhInstalled, listMergedPRsByLabel } from "../gh.js";
import { ensureGitRepo, isCommitAlreadyPickedByX } from "../git.js";
import { pickSessionLabelIfNeeded } from "../prompts.js";
import { listSessionLabels, loadSession, saveSession } from "../session.js";

export function statusCommand(): Command {
	const cmd = new Command("status")
		.description("Show what cherrybridge thinks is pending for a session.")
		.option("--label <label>", "Label session")
		.action(async (opts: { label?: string }) => {
			ensureGitRepo();
			await ensureGhInstalled();

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

			// Refresh PR list for accurate status
			const prs = await listMergedPRsByLabel({ base: session.fromBranch, label });
			session.prs = prs;
			session.lastSyncedAt = new Date().toISOString();
			await saveSession(label, session);

			const pending = [];
			for (const pr of prs) {
				const already = await isCommitAlreadyPickedByX(pr.mergeCommitSha);
				if (!already) pending.push(pr);
			}

			console.log(`Session: ${label}`);
			console.log(`From: ${session.fromBranch} → To: ${session.toBranch}`);
			console.log(`Promotion branch: ${session.promotionBranch}`);
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

