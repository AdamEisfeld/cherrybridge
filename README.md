# cherrybridge

Resumable cherry-picking of merged PR merge commits (selected by label) from one base branch to another.

## Requirements
- git
- GitHub CLI: `gh` (authenticated)

## Install (local dev)
```bash
npm i
npm run build
npm link
```

## Usage

Start a session:
```bash
cherrybridge pick
```

Continue after resolving conflicts (or to pick new PRs that landed):
```bash
cherrybridge continue
```

Cancel session:
```bash
cherrybridge cancel
```

View status:
```bash
cherrybridge status
```

## How It Works

1. **pick** creates a label-based session folder under `.cherrybridge/<label>/`.
2. It always re-fetches PRs from GitHub (via `gh pr list ...`).
3. It cherry-picks merge commits one-by-one using `git cherry-pick -m 1 -x`.
4. On conflict: stops immediately and lets the user resolve.
5. **continue** runs `git cherry-pick --continue` if needed, re-fetches PRs for the label, and applies any new ones not already present (detected via `-x` grep).
6. **cancel** aborts cherry-pick and deletes the session folder.


