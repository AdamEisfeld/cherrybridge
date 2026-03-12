import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import prompts from "prompts";
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
		.option("--label <label>", "Label to apply to the found PRs")
		.option("--from <branch>", "Branch the PRs were merged into (default: development)")
		.option("--prefix <prefix>", "JIRA ticket prefix (default: PROJECT)")
		.action(
			async (opts: { tickets?: string; ticketsFile?: string; label?: string; from?: string; prefix?: string }) => {
				ensureGitRepo();
				await ensureGhInstalled();

				if (!opts.tickets && !opts.ticketsFile) {
					console.error("Error: Provide at least one of --tickets or --tickets-file.");
					process.exit(1);
				}
				if (!opts.label?.trim()) {
					console.error("Error: --label is required.");
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

				let baseBranch = opts.from?.trim();
				if (!baseBranch) {
					const res = await prompts({
						type: "text",
						name: "from",
						message: "Which branch were the PRs merged into?",
						initial: "development",
						validate: (v: string | undefined) => (String(v || "").trim().length ? true : "Branch is required")
					});
					baseBranch = (res.from as string)?.trim();
				}
				if (!baseBranch) {
					console.error("Error: Base branch is required.");
					process.exit(1);
				}

				const prMap = new Map<number, { number: number; title: string }>();
				for (const ticket of tickets) {
					const prs = await searchMergedPRsByTitle(ticket, baseBranch);
					for (const pr of prs) {
						prMap.set(pr.number, pr);
					}
				}
				const prs = Array.from(prMap.values()).sort((a, b) => a.number - b.number);

				if (prs.length === 0) {
					console.log("No merged PRs found for these tickets.");
					return;
				}

				const labelToApply = opts.label.trim();
				const confirmed = await confirmApplyLabel(tickets, prs, labelToApply, baseBranch);
				if (!confirmed) {
					console.log("Label application cancelled.");
					return;
				}

				const failures: number[] = [];
				for (const pr of prs) {
					try {
						await addLabelToPR(pr.number, labelToApply);
						console.log(`  Labeled #${pr.number}: ${pr.title}`);
					} catch (err) {
						console.error(`  Failed to label #${pr.number}: ${(err as Error).message}`);
						failures.push(pr.number);
					}
				}

				console.log(`\nDone. Label "${labelToApply}" applied to ${prs.length - failures.length} PR(s).`);
				if (failures.length > 0) {
					console.log(`Failed: ${failures.length} PR(s): #${failures.join(", #")}`);
				}
			}
		);

	return cmd;
}
