import { run } from "./utils.js";

export function ensureGitRepo(): void {
	// Validation happens in ensureCleanWorkingTree
}

export async function getCurrentBranch(): Promise<string> {
	const r = await run("git", ["branch", "--show-current"]);
	if (r.code !== 0) throw new Error(r.stderr || "Failed to get current branch.");
	return r.stdout.trim();
}

export async function ensureCleanWorkingTree(requireClean = true): Promise<void> {
	// First check if we're in a git repo
	const repoCheck = await run("git", ["rev-parse", "--is-inside-work-tree"]);
	if (repoCheck.code !== 0) {
		throw new Error("Not in a git repository. Run this command from a git repository root.");
	}

	const r = await run("git", ["status", "--porcelain"]);
	if (r.code !== 0) throw new Error(r.stderr || "git status failed.");
	if (requireClean && r.stdout.trim().length > 0) {
		throw new Error("Working tree is not clean. Commit/stash your changes first.");
	}
}

export async function fetchAll(): Promise<void> {
	await run("git", ["fetch", "--all", "--prune"], { stdio: "inherit" });
}

export async function checkoutNewBranchFrom(branch: string, base: string): Promise<void> {
	// If branch exists locally, just checkout; else create from origin/base if present, else base
	const exists = await run("git", ["rev-parse", "--verify", branch]);
	if (exists.code === 0) {
		await run("git", ["checkout", branch], { stdio: "inherit" });
		return;
	}

	// Make sure base is up to date locally
	await run("git", ["checkout", base], { stdio: "inherit" });
	const pullResult = await run("git", ["pull", "--ff-only"], { stdio: "inherit" });
	// Ignore pull errors if branch doesn't exist remotely

	await run("git", ["checkout", "-b", branch, base], { stdio: "inherit" });
}

export async function cherryPickMergeCommit(sha: string): Promise<boolean> {
	// -m 1 = mainline is parent1 (development side)
	// -x adds "(cherry picked from commit <sha>)" to message, for detection
	const r = await run("git", ["cherry-pick", "-m", "1", "-x", sha], { stdio: "inherit" });
	return r.code === 0;
}

export async function isCommitAlreadyPickedByX(originalSha: string): Promise<boolean> {
	// Search commit messages for "(cherry picked from commit <sha>)"
	// We search for the full SHA to be precise
	const r = await run("git", ["log", "--grep", originalSha, "--format=%H", "-n", "1"]);
	if (r.code !== 0) return false;
	return r.stdout.trim().length > 0;
}

export async function continueCherryPickIfInProgress(): Promise<boolean> {
	// If CHERRY_PICK_HEAD exists, we're mid cherry-pick
	const head = await run("git", ["rev-parse", "--verify", "CHERRY_PICK_HEAD"]);
	if (head.code !== 0) return false;

	// Use --no-edit to preserve the -x flag message for detection
	const r = await run("git", ["cherry-pick", "--continue", "--no-edit"], { stdio: "inherit" });
	if (r.code !== 0) {
		console.log("⚠️ Still conflicted. Resolve conflicts and rerun cherrybridge continue.");
		return true;
	}
	return true;
}

export async function abortCherryPickIfInProgress(): Promise<void> {
	const head = await run("git", ["rev-parse", "--verify", "CHERRY_PICK_HEAD"]);
	if (head.code === 0) {
		throw new Error(
			"You are in the middle of a cherry-pick. Resolve it and run cherrybridge continue, or cherrybridge cancel."
		);
	}
}

export async function abortCherryPick(): Promise<void> {
	await run("git", ["cherry-pick", "--abort"], { stdio: "inherit" });
}

export async function getBranchCherrybridgeConfig(branch: string): Promise<{
	label?: string;
	fromBranch?: string;
	toBranch?: string;
}> {
	const label = await run("git", ["config", `branch.${branch}.cherrybridge.label`]);
	const fromBranch = await run("git", ["config", `branch.${branch}.cherrybridge.fromBranch`]);
	const toBranch = await run("git", ["config", `branch.${branch}.cherrybridge.toBranch`]);

	return {
		label: label.code === 0 ? label.stdout.trim() : undefined,
		fromBranch: fromBranch.code === 0 ? fromBranch.stdout.trim() : undefined,
		toBranch: toBranch.code === 0 ? toBranch.stdout.trim() : undefined
	};
}

export async function setBranchCherrybridgeConfig(
	branch: string,
	label: string,
	fromBranch: string,
	toBranch: string
): Promise<void> {
	await run("git", ["config", `branch.${branch}.cherrybridge.label`, label]);
	await run("git", ["config", `branch.${branch}.cherrybridge.fromBranch`, fromBranch]);
	await run("git", ["config", `branch.${branch}.cherrybridge.toBranch`, toBranch]);
}


