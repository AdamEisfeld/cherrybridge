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

	// Note: mergeCommit is populated for both merge commits AND squash merges
	// For squash merges, it contains the squash commit SHA (single-parent commit)
	// For merge commits, it contains the merge commit SHA (two-parent commit)
	// We filter out only PRs that truly have no mergeCommit (shouldn't happen for merged PRs)
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


