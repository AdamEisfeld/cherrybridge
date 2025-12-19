import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ensureGhInstalled, listMergedPRsByLabel } from "../gh.js";
import {
	ensureGitRepo,
	getCurrentBranch,
	ensureCleanWorkingTree,
	fetchAll,
	checkoutNewBranchFrom,
	cherryPickMergeCommit,
	isCommitAlreadyPickedByX,
	abortCherryPickIfInProgress,
	setBranchCherrybridgeConfig,
	getBranchCherrybridgeConfig
} from "../git.js";
import { promptForMissingValues, promptForVia, confirmCherryPick, promptToUseConfig } from "../prompts.js";
import type { PRInfo } from "../types.js";
import { run } from "../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "../../package.json"), "utf-8")
);

// Shared behavior with `continue` - now takes parameters instead of loading from session
export async function applyPendingCherryPicks(
	label: string,
	fromBranch: string,
	toBranch: string,
	promotionBranch: string
): Promise<void> {
	await ensureCleanWorkingTree();
	await abortCherryPickIfInProgress();

	// Always fetch fresh PR list
	const prs = await listMergedPRsByLabel({ base: fromBranch, label });

	// Recompute pending by scanning for -x lines
	const pending: PRInfo[] = [];
	for (const pr of prs) {
		const already = await isCommitAlreadyPickedByX(pr.mergeCommitSha);
		if (!already) pending.push(pr);
	}

	if (pending.length === 0) {
		console.log(`✅ Nothing to pick. All PR merge commits for "${label}" appear to be applied.`);
		return;
	}

	console.log(`Found ${pending.length} pending PR(s) to cherry-pick onto ${promotionBranch}:`);
	for (const pr of pending) {
		console.log(`- #${pr.number} ${pr.title} (${pr.mergeCommitSha.slice(0, 8)})`);
	}

	// Ask for confirmation before proceeding
	const confirmed = await confirmCherryPick(pending, fromBranch, toBranch, promotionBranch);
	if (!confirmed) {
		console.log("❌ Cherry-pick cancelled.");
		return;
	}

	for (const pr of pending) {
		console.log(`\n🍒 Cherry-picking PR #${pr.number}: ${pr.mergeCommitSha}`);
		const ok = await cherryPickMergeCommit(pr.mergeCommitSha);

		if (!ok) {
			console.log(
				`\n⚠️ Conflict encountered on PR #${pr.number} (${pr.mergeCommitSha.slice(0, 8)}).\n` +
					`\nTo resolve:\n` +
					`1. Fix the conflicts in the files (remove conflict markers: <<<<<<<, =======, >>>>>>>)\n` +
					`2. Stage the resolved files:\n` +
					`   git add <file>\n` +
					`   # or stage all resolved files:\n` +
					`   git add .\n` +
					`3. Continue the cherry-pick:\n` +
					`   cherrybridge continue --from ${fromBranch} --to ${toBranch} --label ${label}\n\n` +
					`Or to abort:\n` +
					`   cherrybridge cancel\n`
			);
			return;
		}
	}

	// Store branch config for future reference after successful completion
	await setBranchCherrybridgeConfig(promotionBranch, label, fromBranch, toBranch);

	console.log(`\n✅ Done. You can now push and open a PR into "${toBranch}".`);
	console.log(
		`Suggested:\n  git push -u origin ${promotionBranch}\n  gh pr create --base ${toBranch} --head ${promotionBranch}\n`
	);
}

export function pickCommand(): Command {
	const cmd = new Command("pick")
		.description("Interactively pick merged PR merge commits (by label) onto a target branch.")
		.option("--from <branch>", "Source base branch PRs were merged into")
		.option("--to <branch>", "Target base branch to promote into")
		.option("--label <label>", "Label used to group PRs (e.g. feature:ABC-123)")
		.option("--via <branch>", "Branch to use for promotion (defaults to current branch)")
		.action(async (opts: { from?: string; to?: string; label?: string; via?: string }) => {
			// Display ASCII art
			console.log(`
                           
                              ██                                
                  ██    ██████                                  
                  ██  ██▒▒▒▒██                                  
                ██████▒▒▒▒▒▒██                                  
                ██  ██▒▒▒▒██                                    
              ██    ██████                                      
            ██    ██                                            
            ██    ██                                            
          ██        ██                                          
        ██            ████████                                  
    ████████        ██▒▒▒▒▒▒▒▒██                                
  ██▒▒▒▒▒▒▒▒██    ██▒▒▒▒▒▒▒▒▒▒▒▒██                cherrybridge v${packageJson.version}                              
██▒▒▒▒▒▒  ▒▒▒▒██  ██▒▒▒▒▒▒▒▒▒▒▒▒██                              
██▒▒▒▒▒▒▒▒  ▒▒██  ██▒▒  ▒▒▒▒▒▒▒▒██                              
██▒▒▒▒▒▒▒▒  ▒▒██  ██▒▒▒▒    ▒▒▒▒██                              
██▒▒▒▒▒▒▒▒▒▒▒▒██    ██▒▒▒▒▒▒▒▒██                                
  ██▒▒▒▒▒▒▒▒██        ████████                                  
    ████████                                                    
`);

			ensureGitRepo();
			await ensureGhInstalled();
			await ensureCleanWorkingTree();

			await fetchAll();

			// Prompt for via if not provided, defaulting to current branch
			const currentBranch = await getCurrentBranch();
			const promotionBranch = opts.via ?? (await promptForVia("", currentBranch));

			// Try to infer values from branch config
			const branchConfig = await getBranchCherrybridgeConfig(promotionBranch);

			let useConfig = false;
			if (branchConfig.label || branchConfig.fromBranch || branchConfig.toBranch) {
				useConfig = await promptToUseConfig(branchConfig);
			}

			const { from, to, label } = await promptForMissingValues({
				from: opts.from ?? (useConfig ? branchConfig.fromBranch : undefined),
				to: opts.to ?? (useConfig ? branchConfig.toBranch : undefined),
				label: opts.label ?? (useConfig ? branchConfig.label : undefined)
			});

			const fromBranch = from;
			const toBranch = to;

			// Store config for future reference (even if we don't cherry-pick yet)
			await setBranchCherrybridgeConfig(promotionBranch, label, fromBranch, toBranch);

			// Checkout or create the branch from target base
			await checkoutNewBranchFrom(promotionBranch, toBranch);

			await applyPendingCherryPicks(label, fromBranch, toBranch, promotionBranch);
		});

	return cmd;
}
