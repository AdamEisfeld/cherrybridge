import prompts from "prompts";
import type { PRInfo } from "./types.js";

export async function promptForMissingValues(args: {
	from?: string;
	to?: string;
	label?: string;
}): Promise<{ from: string; to: string; label: string }> {
	const questions: prompts.PromptObject[] = [];

	if (!args.from) {
		questions.push({
			type: "text",
			name: "from",
			message: "Obtain PRs merged into which base branch?",
			initial: "development"
		});
	}

	if (!args.to) {
		questions.push({
			type: "text",
			name: "to",
			message: "Cherry-pick into which target base branch?",
			initial: "staging"
		});
	}

	if (!args.label) {
		questions.push({
			type: "text",
			name: "label",
			message: "Which PR label should be used to select PRs?",
			validate: (v: string | undefined) => (String(v || "").trim().length ? true : "Label is required")
		});
	}

	const res = await prompts(questions);

	const from = args.from ?? (res.from as string);
	const to = args.to ?? (res.to as string);
	const label = args.label ?? (res.label as string);

	if (!label) throw new Error("Label is required.");

	return { from, to, label };
}

export async function promptForVia(
	label: string,
	defaultVia?: string,
	fromBranch?: string,
	toBranch?: string
): Promise<string> {
	let defaultBranch = defaultVia;
	if (!defaultBranch && label) {
		defaultBranch = `promote/${label.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
	}

	// If default equals from or to branch, don't provide a default (user must enter one)
	const shouldProvideDefault =
		defaultBranch && defaultBranch !== fromBranch && defaultBranch !== toBranch;

	const promptConfig: prompts.PromptObject = {
		type: "text",
		name: "via",
		message: "Which branch should be used for promotion?",
		validate: (v: string | undefined) => {
			const branch = String(v || "").trim();
			if (!branch) return "Branch name is required.";
			if (fromBranch && branch === fromBranch)
				return "Cannot use the source branch as promotion branch.";
			if (toBranch && branch === toBranch)
				return "Cannot use the target branch as promotion branch.";
			return true;
		}
	};

	if (shouldProvideDefault && defaultBranch) {
		promptConfig.initial = defaultBranch;
	}

	const res = await prompts(promptConfig);

	const result = (res.via as string)?.trim();
	if (!result) throw new Error("Branch name is required.");
	return result;
}

export async function promptToUseConfig(config: {
	label?: string;
	fromBranch?: string;
	toBranch?: string;
}): Promise<boolean> {
	const hasConfig = config.label || config.fromBranch || config.toBranch;
	if (!hasConfig) return false;

	console.log(`\n📋 Found cherrybridge config for this branch:`);
	if (config.label) console.log(`   Label: ${config.label}`);
	if (config.fromBranch) console.log(`   From: ${config.fromBranch}`);
	if (config.toBranch) console.log(`   To: ${config.toBranch}`);

	const res = await prompts({
		type: "confirm",
		name: "value",
		message: "Use these values?",
		initial: true
	});

	return res.value === true;
}

export async function confirmCherryPick(
	pendingPRs: PRInfo[],
	fromBranch: string,
	toBranch: string,
	promotionBranch: string
): Promise<boolean> {
	console.log(`\n📋 Summary:`);
	console.log(`   From: ${fromBranch}`);
	console.log(`   To: ${toBranch}`);
	console.log(`   Via: ${promotionBranch}`);
	console.log(`   PRs to cherry-pick: ${pendingPRs.length}`);
	console.log(`\nPRs that will be cherry-picked:`);
	for (const pr of pendingPRs) {
		console.log(`   - #${pr.number}: ${pr.title} (${pr.mergeCommitSha.slice(0, 8)})`);
	}

	const res = await prompts({
		type: "confirm",
		name: "value",
		message: `Proceed with cherry-picking ${pendingPRs.length} PR(s)?`,
		initial: true
	});

	return res.value === true;
}

