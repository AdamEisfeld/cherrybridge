import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import prompts from "prompts";
import { ensureGhInstalled, searchMergedPRsByTitle, addLabelToPR, ensureLabelExists } from "../gh.js";
import { ensureGitRepo, getRepoCherrybridgeConfig } from "../git.js";
import { confirmApplyLabel } from "../prompts.js";
import { extractJiraTickets } from "../utils.js";

function defaultLabelName(): string {
	// YYYY-MM-DD in local time (so the label matches the user's calendar day, not UTC)
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `cherry-${y}-${m}-${d}`;
}

export function labelCommand(): Command {
	const cmd = new Command("label")
		.description("Find merged PRs by JIRA ticket and apply a label. Tickets may be passed as positional args, --tickets, or --tickets-file.")
		.argument("[tickets...]", "JIRA ticket IDs (e.g. OGENG-1234 OGENG-2324); commas are ignored")
		.option("--tickets <text>", "Inline text containing JIRA links/IDs (in addition to positional args)")
		.option("--tickets-file <path>", "Path to file containing JIRA links/IDs")
		.option("--label <label>", "Label to apply to the found PRs (prompted if omitted)")
		.option("--from <branch>", "Branch the PRs were merged into (default: development)")
		.option("--prefix <prefix>", "JIRA ticket prefix (default: PROJECT)")
		.option("--create", "Create the label in the repo if it does not exist")
		.action(
			async (
				positionalTickets: string[],
				opts: { tickets?: string; ticketsFile?: string; label?: string; from?: string; prefix?: string; create?: boolean }
			) => {
				ensureGitRepo();
				await ensureGhInstalled();

				const hasPositional = positionalTickets.length > 0;
				if (!hasPositional && !opts.tickets && !opts.ticketsFile) {
					console.error("Error: provide ticket IDs as positional args, or via --tickets / --tickets-file.");
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
				if (hasPositional) {
					// Commas/whitespace between tokens are ignored by the JIRA regex; just join.
					const joined = positionalTickets.join(" ");
					resolvedText = resolvedText ? `${resolvedText}\n${joined}` : joined;
				}

				const repoConfig = await getRepoCherrybridgeConfig();
				const prefix = opts.prefix ?? repoConfig.prefix ?? "PROJECT";

				const tickets = extractJiraTickets(resolvedText, prefix);
				if (tickets.length === 0) {
					console.log("No JIRA tickets found in the provided input.");
					return;
				}

				console.log(`Tickets (${tickets.length}): ${tickets.join(", ")}`);

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

				let labelToApply = opts.label?.trim();
				if (!labelToApply) {
					const res = await prompts({
						type: "text",
						name: "label",
						message: "Label to apply",
						initial: defaultLabelName(),
						validate: (v: string | undefined) => (String(v || "").trim().length ? true : "Label is required")
					});
					labelToApply = (res.label as string)?.trim();
				}
				if (!labelToApply) {
					console.error("Error: label is required.");
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

				const confirmed = await confirmApplyLabel(tickets, prs, labelToApply, baseBranch);
				if (!confirmed) {
					console.log("Label application cancelled.");
					return;
				}

				if (opts.create) {
					console.log("Ensuring label exists...");
					await ensureLabelExists(labelToApply);
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
