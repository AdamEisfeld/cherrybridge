import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { getFileConfig } from "../config.js";
import { ensureGhInstalled, searchMergedPRsByTitle, addLabelToPR } from "../gh.js";
import { ensureGitRepo } from "../git.js";
import { confirmApplyLabel } from "../prompts.js";
import { extractJiraTickets } from "../utils.js";

export function labelCommand(): Command {
	const cmd = new Command("label")
		.description("Extract JIRA tickets from text, find merged PRs by title, and apply a label.")
		.option("--tickets <text>", "Inline text containing JIRA links/IDs")
		.option("--tickets-file <path>", "Path to file containing JIRA links/IDs")
		.option("--add-label <label>", "Label to apply to the found PRs")
		.option("--prefix <prefix>", "JIRA ticket prefix (default: PROJECT)")
		.action(
			async (opts: { tickets?: string; ticketsFile?: string; addLabel?: string; prefix?: string }) => {
				ensureGitRepo();
				await ensureGhInstalled();

				if (!opts.tickets && !opts.ticketsFile) {
					console.error("Error: Provide at least one of --tickets or --tickets-file.");
					process.exit(1);
				}
				if (!opts.addLabel?.trim()) {
					console.error("Error: --add-label is required.");
					process.exit(1);
				}

				let resolvedText = "";
				if (opts.ticketsFile) {
					const filePath = resolve(process.cwd(), opts.ticketsFile);
					try {
						resolvedText = await readFile(filePath, "utf-8");
					} catch (err) {
						console.error(`Error: Could not read --tickets-file: ${(err as Error).message}`);
						process.exit(1);
					}
				}
				if (opts.tickets?.trim()) {
					resolvedText = resolvedText ? `${resolvedText}\n${opts.tickets}` : opts.tickets;
				}

				const fileConfig = await getFileConfig();
				const prefix = opts.prefix ?? fileConfig?.prefix ?? "PROJECT";

				const tickets = extractJiraTickets(resolvedText, prefix);
				if (tickets.length === 0) {
					console.log("No JIRA tickets found in the provided text.");
					return;
				}

				const prMap = new Map<number, { number: number; title: string }>();
				for (const ticket of tickets) {
					const prs = await searchMergedPRsByTitle(ticket);
					for (const pr of prs) {
						prMap.set(pr.number, pr);
					}
				}
				const prs = Array.from(prMap.values()).sort((a, b) => a.number - b.number);

				if (prs.length === 0) {
					console.log("No merged PRs found for these tickets.");
					return;
				}

				const confirmed = await confirmApplyLabel(tickets, prs, opts.addLabel.trim());
				if (!confirmed) {
					console.log("Label application cancelled.");
					return;
				}

				const failures: number[] = [];
				for (const pr of prs) {
					try {
						await addLabelToPR(pr.number, opts.addLabel.trim());
						console.log(`  Labeled #${pr.number}: ${pr.title}`);
					} catch (err) {
						console.error(`  Failed to label #${pr.number}: ${(err as Error).message}`);
						failures.push(pr.number);
					}
				}

				console.log(`\nDone. Label "${opts.addLabel.trim()}" applied to ${prs.length - failures.length} PR(s).`);
				if (failures.length > 0) {
					console.log(`Failed: ${failures.length} PR(s): #${failures.join(", #")}`);
				}
			}
		);

	return cmd;
}
