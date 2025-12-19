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

export async function promptForVia(label: string, defaultVia?: string): Promise<string> {
	const defaultBranch = defaultVia ?? `promote/${label.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;

	const res = await prompts({
		type: "text",
		name: "via",
		message: "Which branch should be used for promotion?",
		initial: defaultBranch
	});

	return (res.via as string) || defaultBranch;
}

