import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type FileConfig = {
	prefix?: string;
	projectUrl?: string;
};

const CONFIG_FILENAME = ".cherrybridgerc.json";

/**
 * Load cherrybridge config from .cherrybridgerc.json in the current working directory.
 * Returns null if the file does not exist or is invalid.
 */
export async function getFileConfig(): Promise<FileConfig | null> {
	const filePath = join(process.cwd(), CONFIG_FILENAME);
	try {
		const raw = await readFile(filePath, "utf-8");
		const data = JSON.parse(raw) as unknown;
		if (data !== null && typeof data === "object" && !Array.isArray(data)) {
			return {
				prefix: typeof (data as Record<string, unknown>).prefix === "string" ? (data as Record<string, unknown>).prefix as string : undefined,
				projectUrl: typeof (data as Record<string, unknown>).projectUrl === "string" ? (data as Record<string, unknown>).projectUrl as string : undefined
			};
		}
		return null;
	} catch {
		return null;
	}
}
