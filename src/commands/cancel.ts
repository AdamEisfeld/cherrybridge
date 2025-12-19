import { Command } from "commander";
import { ensureGitRepo, abortCherryPick, ensureCleanWorkingTree } from "../git.js";
import { pickSessionLabelIfNeeded } from "../prompts.js";
import { deleteSessionDir, listSessionLabels, loadSession } from "../session.js";

export function cancelCommand(): Command {
	const cmd = new Command("cancel")
		.description("Abort an in-progress cherry-pick and delete the local session folder.")
		.option("--label <label>", "Label session to cancel")
		.action(async (opts: { label?: string }) => {
			ensureGitRepo();

			const labels = await listSessionLabels();
			if (labels.length === 0) {
				console.log("No sessions found.");
				return;
			}

			const label =
				opts.label ??
				(labels.length === 1 ? labels[0] : await pickSessionLabelIfNeeded(labels));

			const session = await loadSession(label);
			if (!session) {
				throw new Error(`No session found for label "${label}".`);
			}

			await ensureCleanWorkingTree(false); // allow dirty since we might be in conflict state
			await abortCherryPick();
			await deleteSessionDir(label);

			console.log(`🧹 Cancelled and removed session "${label}".`);
			console.log(
				`Note: promotion branch "${session.promotionBranch}" (local) is not deleted automatically.`
			);
		});

	return cmd;
}

