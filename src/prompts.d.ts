declare module "prompts" {
	export type PromptType =
		| "text"
		| "password"
		| "invisible"
		| "number"
		| "confirm"
		| "list"
		| "toggle"
		| "select"
		| "multiselect"
		| "autocomplete"
		| "date"
		| "autocompleteMultiselect";

	export type PromptObject = {
		type: PromptType;
		name: string;
		message: string;
		initial?: string | number | boolean;
		validate?: (value: string | undefined) => boolean | string;
		choices?: Array<{ title: string; value: string }>;
	};

	export default function prompts(
		questions: PromptObject | PromptObject[]
	): Promise<Record<string, any>>;
}


