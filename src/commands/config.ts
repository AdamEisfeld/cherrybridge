import { Command } from "commander";
import {
	ensureCleanWorkingTree,
	getRepoCherrybridgeConfig,
	setRepoCherrybridgeConfigValue,
	unsetRepoCherrybridgeConfigValue,
	REPO_CONFIG_KEYS,
	type RepoConfigKey
} from "../git.js";

function assertKey(key: string): asserts key is RepoConfigKey {
	if (!(REPO_CONFIG_KEYS as readonly string[]).includes(key)) {
		console.error(
			`Error: unknown config key "${key}". Supported keys: ${REPO_CONFIG_KEYS.join(", ")}.`
		);
		process.exit(1);
	}
}

async function ensureInRepo(): Promise<void> {
	// Reuse the repo check baked into ensureCleanWorkingTree; allow dirty trees since config doesn't touch the index.
	await ensureCleanWorkingTree(false);
}

export function configCommand(): Command {
	const cmd = new Command("config").description(
		`Manage cherrybridge config in this repo's .git/config (keys: ${REPO_CONFIG_KEYS.join(", ")}).`
	);

	cmd.command("set <key> <value>")
		.description("Set a config value for this repo.")
		.action(async (key: string, value: string) => {
			await ensureInRepo();
			assertKey(key);
			await setRepoCherrybridgeConfigValue(key, value);
			console.log(`✅ cherrybridge.${key} = ${value}`);
		});

	cmd.command("get <key>")
		.description("Print a config value.")
		.action(async (key: string) => {
			await ensureInRepo();
			assertKey(key);
			const config = await getRepoCherrybridgeConfig();
			const value = config[key];
			if (value === undefined) {
				console.error(`cherrybridge.${key} is not set.`);
				process.exit(1);
			}
			console.log(value);
		});

	cmd.command("list")
		.description("List all cherrybridge config values for this repo.")
		.action(async () => {
			await ensureInRepo();
			const config = await getRepoCherrybridgeConfig();
			const entries = REPO_CONFIG_KEYS.map((k) => [k, config[k]] as const).filter(
				([, v]) => v !== undefined
			);
			if (entries.length === 0) {
				console.log("(no cherrybridge config set in this repo)");
				return;
			}
			for (const [k, v] of entries) {
				console.log(`cherrybridge.${k}=${v}`);
			}
		});

	cmd.command("unset <key>")
		.description("Remove a config value.")
		.action(async (key: string) => {
			await ensureInRepo();
			assertKey(key);
			const removed = await unsetRepoCherrybridgeConfigValue(key);
			if (removed) {
				console.log(`✅ removed cherrybridge.${key}`);
			} else {
				console.log(`cherrybridge.${key} was not set; nothing to do.`);
			}
		});

	return cmd;
}
