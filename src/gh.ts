import { run } from "./utils.js";
import type { PRInfo } from "./types.js";

export async function ensureGhInstalled(): Promise<void> {
	const r = await run("gh", ["--version"]);
	if (r.code !== 0) {
		throw new Error("GitHub CLI (gh) is required. Install it and authenticate (gh auth login).");
	}
}

export async function listMergedPRsByLabel(args: { base: string; label: string }): Promise<PRInfo[]> {
	// Requires: gh auth already done
	const r = await run("gh", [
		"pr",
		"list",
		"--state",
		"merged",
		"--base",
		args.base,
		"--label",
		args.label,
		"--json",
		"number,title,mergedAt,mergeCommit"
	]);

	if (r.code !== 0) {
		throw new Error(r.stderr || "Failed to list PRs. Are you in a GitHub repo and authenticated?");
	}

	const data = JSON.parse(r.stdout) as Array<{
		number: number;
		title: string;
		mergedAt: string;
		mergeCommit: { oid: string } | null;
	}>;

	// Filter PRs that were merged without a merge commit (e.g. squash/rebase into base)
	// For now we require merge commits; later we can add fallback.
	const prs = data
		.filter((x) => x.mergeCommit?.oid)
		.map((x) => ({
			number: x.number,
			title: x.title,
			mergedAt: x.mergedAt,
			mergeCommitSha: x.mergeCommit!.oid
		}));

	// stable ordering: merge time ascending
	prs.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
	return prs;
}


