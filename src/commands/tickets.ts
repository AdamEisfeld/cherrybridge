import { Command } from "commander";
import { getFileConfig } from "../config.js";
import { ensureGhInstalled, listMergedPRsWithDetails } from "../gh.js";
import { ensureGitRepo } from "../git.js";
import { promptForMissingValues } from "../prompts.js";
import { extractJiraTickets } from "../utils.js";

export function ticketsCommand(): Command {
	const cmd = new Command("tickets")
		.description("Extract JIRA tickets from PRs matching a label.")
		.option("--label <label>", "Label used to select PRs")
		.option("--from <branch>", "Source base branch PRs were merged into (default: development)")
		.option("--prefix <prefix>", "JIRA ticket prefix (default: PROJECT)")
		.action(async (opts: { label?: string; from?: string; prefix?: string }) => {
			ensureGitRepo();
			await ensureGhInstalled();

			const fileConfig = await getFileConfig();

			const { from, label } = await promptForMissingValues({
				from: opts.from,
				to: undefined, // Not needed for tickets command
				label: opts.label
			});

			const prefix = opts.prefix ?? fileConfig?.prefix ?? "PROJECT";

			// Fetch PRs with details
			const prs = await listMergedPRsWithDetails({ base: from, label });

			// Extract tickets from all PRs
			const allTickets = new Set<string>();

			for (const pr of prs) {
				// Extract from title
				const titleTickets = extractJiraTickets(pr.title, prefix);
				titleTickets.forEach((ticket) => allTickets.add(ticket));

				// Extract from branch name
				if (pr.headRefName) {
					const branchTickets = extractJiraTickets(pr.headRefName, prefix);
					branchTickets.forEach((ticket) => allTickets.add(ticket));
				}

				// Extract from description
				if (pr.body) {
					const bodyTickets = extractJiraTickets(pr.body, prefix);
					bodyTickets.forEach((ticket) => allTickets.add(ticket));
				}
			}

			// Output as sorted array in brackets format
			const sortedTickets = Array.from(allTickets).sort();
			console.log(`[${sortedTickets.join(", ")}]`);
		});

	return cmd;
}
