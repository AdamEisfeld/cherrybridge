import prompts from "prompts";

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
	let defaultBranch = defaultVia ?? `promote/${label.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;

	// If default equals from or to branch, don't provide a default (user must enter one)
	const shouldProvideDefault = defaultBranch !== fromBranch && defaultBranch !== toBranch;

	const promptConfig: prompts.PromptObject = {
		type: "text",
		name: "via",
		message: "Which branch should be used for promotion?",
		validate: (v: string | undefined) => {
			const branch = String(v || "").trim();
			if (!branch) return "Branch name is required.";
			if (branch === fromBranch) return "Cannot use the source branch as promotion branch.";
			if (branch === toBranch) return "Cannot use the target branch as promotion branch.";
			return true;
		}
	};

	if (shouldProvideDefault) {
		promptConfig.initial = defaultBranch;
	}

	const res = await prompts(promptConfig);

	const result = (res.via as string)?.trim();
	if (!result) throw new Error("Branch name is required.");
	return result;
}

