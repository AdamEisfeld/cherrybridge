import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Session } from "./types.js";
import { run } from "./utils.js";

const ROOT = ".cherrybridge";

// Get a unique identifier for the current repo
async function getRepoId(): Promise<string> {
	// Try to get repo name from remote URL
	const remoteResult = await run("git", ["config", "--get", "remote.origin.url"]);
	if (remoteResult.code === 0) {
		const url = remoteResult.stdout.trim();
		// Extract repo name from URL (e.g., github.com/owner/repo.git -> owner-repo)
		const match = url.match(/(?:github\.com[/:]|git@github\.com:)(.+?)\/(.+?)(?:\.git)?$/);
		if (match) {
			return `${match[1]}-${match[2]}`;
		}
	}

	// Fallback: use repo directory name
	const cwd = process.cwd();
	return path.basename(cwd);
}

// Get the session root directory (outside the repo)
async function getSessionRoot(): Promise<string> {
	const repoId = await getRepoId();
	return path.join(os.homedir(), ROOT, repoId);
}

export async function ensureSessionDir(label: string): Promise<string> {
	const root = await getSessionRoot();
	const dir = path.join(root, sanitize(label));
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export async function listSessionLabels(): Promise<string[]> {
	const root = await getSessionRoot();
	if (!fs.existsSync(root)) return [];
	return fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
}

export async function loadSession(labelOrSanitized: string): Promise<Session | null> {
	const sessionPath = await getSessionPath(labelOrSanitized);
	if (!fs.existsSync(sessionPath)) return null;
	return JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Session;
}

export async function saveSession(labelOrSanitized: string, session: Session): Promise<void> {
	const sessionPath = await getSessionPath(labelOrSanitized);
	fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
	fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");
}

export async function deleteSessionDir(labelOrSanitized: string): Promise<void> {
	const root = await getSessionRoot();
	const dir = path.join(root, sanitize(labelOrSanitized));
	if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

async function getSessionPath(labelOrSanitized: string): Promise<string> {
	const root = await getSessionRoot();
	const dir = path.join(root, sanitize(labelOrSanitized));
	return path.join(dir, "session.json");
}

function sanitize(label: string): string {
	return label.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

