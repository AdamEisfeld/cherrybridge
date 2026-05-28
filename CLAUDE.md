# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`cherrybridge` is a small CLI (Node.js / TypeScript / Commander) that promotes merged GitHub PRs from one base branch to another by cherry-picking their merge commits. PRs are selected by a GitHub label (e.g. `feature:ABC-123`). Sessions are resumable across conflicts, and per-branch settings are persisted in git config so a follow-up `continue` needs no flags.

The tool shells out heavily to `git` and `gh` — almost no logic runs in Node beyond orchestration, prompting, and parsing JSON output from the GitHub CLI.

## Commands

```bash
npm run dev          # Run CLI from TS source via tsx (no build needed)
npm run build        # tsc -> dist/
npm run watch        # tsc --watch
npm start            # node dist/index.js (run the built CLI)
npm link             # Make `cherrybridge` available globally for local testing
```

There are no tests, no lint config, and no test runner — don't claim test coverage. Manual testing is done by linking and running the binary inside a real repo (sample inputs live in `testfiles/`).

To run the CLI directly during development without building:

```bash
npm run dev -- pick --label feature:ABC-123 --via promote/abc-123
```

## Runtime requirements

The CLI assumes both `git` and `gh` are on PATH, and that `gh auth login` has been run. `ensureGhInstalled()` / `ensureGitRepo()` / `ensureCleanWorkingTree()` are called at the top of every command — preserve that order when adding new commands.

## Architecture

The codebase is tiny and flat. Entry point: `src/index.ts` -> `src/cli.ts` registers one Commander subcommand per file in `src/commands/`.

Layers (no DI, just module imports):

- `src/commands/*.ts` — one Commander command per file (`pick`, `continue`, `cancel`, `status`, `pr`, `tickets`, `label`, `config`). These wire prompts + git + gh together.
- `src/git.ts` — every git operation. Branch checkout/create, cherry-pick (`-x` flag, `-m 1` for merge commits), in-progress detection via `CHERRY_PICK_HEAD`, and all cherrybridge config (per-branch under `branch.<name>.cherrybridge.*`, repo-wide under `cherrybridge.*`).
- `src/gh.ts` — every `gh` CLI call. `gh pr list ... --json mergeCommit` is the data source; `mergeCommit.oid` is the SHA cherry-picked.
- `src/prompts.ts` — interactive prompts (uses the `prompts` library; types in `prompts.d.ts`).
- `src/utils.ts` — `run()` wrapper around `child_process.spawn` returning `{ code, stdout, stderr }`, plus `extractJiraTickets()`.
- `src/types.ts` — `PRInfo` / `PRInfoWithDetails`.

### Two persistence mechanisms (don't confuse them)

Both live in the repo's `.git/config` (local, not pushed):

1. **Per-branch config** (`branch.<branch>.cherrybridge.{label,fromBranch,toBranch}`) — promotion-branch state. Set after a successful `pick` and read by `continue` / `status` / `pr`. Cleared by `cancel`. This is what makes the tool "resumable."
2. **Repo-wide config** (`cherrybridge.{prefix,projectUrl}`) — defaults for JIRA prefix and ticket URL base. Managed via the `cherrybridge config <set|get|list|unset>` subcommand. Allowlist of keys lives in `REPO_CONFIG_KEYS` in `git.ts` — add new keys there and update `RepoConfig` type alongside.

Precedence everywhere: command-line flag > branch config (if user confirms `promptToUseConfig`) > repo config > built-in default.

### Cherry-pick mechanics (the core invariant)

`cherryPickMergeCommit()` in `src/git.ts` inspects the commit with `git rev-list --parents -n 1`:

- 3 hashes -> merge commit -> `git cherry-pick -m 1 -x <sha>` (first parent = PR side)
- 2 hashes -> squash commit -> `git cherry-pick -x <sha>` (no `-m`)

The `-x` flag is **load-bearing**: it appends `(cherry picked from commit <sha>)` to the message. `isCommitAlreadyPickedByX()` greps git log for the original SHA to detect already-applied PRs and avoid duplicates. If you remove `-x` or `--no-edit` (in `continueCherryPickIfInProgress`), idempotency breaks.

Rebase-and-merge PRs are not reliably supported — there's no single SHA to cherry-pick.

### Shared flow between `pick` and `continue`

`applyPendingCherryPicks()` (exported from `src/commands/pick.ts`) is the worker used by both: re-fetches PRs from GitHub, filters out already-picked ones via the `-x` marker, prompts confirmation, then cherry-picks in `mergedAt` ascending order. `continue` calls `continueCherryPickIfInProgress()` first to finish any in-flight conflict before invoking this.

### Conventions

- ESM only (`"type": "module"`, `"module": "ES2022"`, `"moduleResolution": "Bundler"`). All relative imports must use `.js` extensions even though the source is `.ts` — this is required for ESM resolution after compile.
- `strict: true` TS — keep it.
- `run()` never throws on non-zero exit; callers must check `code` and decide. Use `stdio: "inherit"` when the user should see progress (cherry-picks, fetches); default piped capture otherwise.
- ASCII art in `pick.ts` is intentional. Leave it alone.
