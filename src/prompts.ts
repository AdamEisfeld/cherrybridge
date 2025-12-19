import prompts from "prompts";

export async function chooseBranchesAndLabel(args: {
	from: string;
	to: string;
	label?: string | undefined;
}): Promise<{ from: string; to: string; label: string }> {
	const questions: prompts.PromptObject[] = [
		{
			type: "text",
			name: "from",
			message: "Obtain PRs merged into which base branch?",
			initial: args.from
		},
		{
			type: "text",
			name: "to",
			message: "Cherry-pick into which target base branch?",
			initial: args.to
		}
	];

	if (!args.label) {
		questions.push({
			type: "text",
			name: "label",
			message: "Which PR label should be used to select PRs?",
			validate: (v: string | undefined) => (String(v || "").trim().length ? true : "Label is required")
		});
	}

	const res = await prompts(questions);

	const label = args.label ?? res.label;
	if (!label) throw new Error("Label is required.");

	return { from: res.from as string, to: res.to as string, label };
}

export async function pickSessionLabelIfNeeded(labels: string[]): Promise<string> {
	const res = await prompts({
		type: "select",
		name: "label",
		message: "Multiple cherrybridge sessions found. Which one?",
		choices: labels.map((l) => ({ title: l, value: l }))
	});
	return res.label as string;
}

