import { Command } from "commander";
import { ensureGhInstalled, listMergedPRsWithDetails, getRepoUrl } from "../gh.js";
import { ensureGitRepo, getCurrentBranch, getBranchCherrybridgeConfig, getRepoCherrybridgeConfig } from "../git.js";
import { promptForMissingValues, promptForVia, promptToUseConfig } from "../prompts.js";
import { extractJiraTickets } from "../utils.js";

function capitalizeBranch(branch: string): string {
	if (!branch) return branch;
	return branch.charAt(0).toUpperCase() + branch.slice(1);
}

/**
 * Build and print the cherry-pick PR's title/body for the given session.
 * Loads `prefix` / `projectUrl` from repo config unless overrides are supplied.
 * Used both by the `pr` command and by `pick` to emit the summary at the end of a successful run.
 */
export async function printPRSummary(args: {
	fromBranch: string;
	toBranch: string;
	label: string;
	prefixOverride?: string;
	projectUrlOverride?: string;
}): Promise<void> {
	const repoConfig = await getRepoCherrybridgeConfig();
	const prefix = args.prefixOverride ?? repoConfig.prefix ?? "PROJECT";
	const projectBase = (args.projectUrlOverride ?? repoConfig.projectUrl)?.replace(/\/$/, "") ?? null;

	const prs = await listMergedPRsWithDetails({ base: args.fromBranch, label: args.label });

	const allTickets = new Set<string>();
	for (const pr of prs) {
		extractJiraTickets(pr.title, prefix).forEach((t) => allTickets.add(t));
		if (pr.headRefName) {
			extractJiraTickets(pr.headRefName, prefix).forEach((t) => allTickets.add(t));
		}
		if (pr.body) {
			extractJiraTickets(pr.body, prefix).forEach((t) => allTickets.add(t));
		}
	}

	const sortedTickets = Array.from(allTickets).sort();
	const fromDisplay = capitalizeBranch(args.fromBranch);
	const toDisplay = capitalizeBranch(args.toBranch);
	const title = `[${sortedTickets.join(", ")}] - Cherry Pick ${fromDisplay} -> ${toDisplay}`;

	const repoUrl = await getRepoUrl();
	const prLines = prs.map((pr) => `- ${repoUrl}/pull/${pr.number}`);
	const ticketLines = sortedTickets.map((t) => (projectBase ? `- ${projectBase}/${t}` : `- ${t}`));

	const body = ["PRs:", ...prLines, "", "Tickets:", ...ticketLines].join("\n");

	console.log("Title:", title);
	console.log("");
	console.log("Body:");
	console.log(body);
}

export function prCommand(): Command {
	const cmd = new Command("pr")
		.description("Output PR title and body for the cherry-pick PR to the target branch.")
		.option("--label <label>", "Label used to select PRs")
		.option("--from <branch>", "Source base branch PRs were merged into")
		.option("--to <branch>", "Target base branch to promote into")
		.option("--prefix <prefix>", "JIRA ticket prefix (default: PROJECT)")
		.option("--via <branch>", "Branch to use for config (defaults to current branch)")
		.option("--project-url <url>", "Base URL for ticket links (e.g. https://company.atlassian.net/browse)")
		.action(async (opts: { from?: string; to?: string; label?: string; prefix?: string; via?: string; projectUrl?: string }) => {
			ensureGitRepo();
			await ensureGhInstalled();

			// Resolve via for branch config
			const currentBranch = await getCurrentBranch();
			const promotionBranch = opts.via ?? (await promptForVia("", currentBranch));

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

			await printPRSummary({
				fromBranch: from,
				toBranch: to,
				label,
				prefixOverride: opts.prefix,
				projectUrlOverride: opts.projectUrl
			});
		});

	return cmd;
}
