# cherrybridge

Resumable cherry-picking of merged PR merge commits (selected by label) from one base branch to another.

## Features

- **Label-based PR selection**: Automatically finds and cherry-picks PRs based on GitHub labels
- **Resumable**: Pause and resume cherry-picking sessions, even after resolving conflicts
- **Automatic detection**: Detects already-picked commits using Git's `-x` flag
- **Smart defaults**: Defaults to `development` → `staging` workflow (customizable)
- **Branch config storage**: Remembers your settings per branch for seamless continuation
- **Conflict handling**: Clear instructions when conflicts occur

## Requirements

- **git**: Version control system
- **GitHub CLI (`gh`)**: Must be installed and authenticated (`gh auth login`)

## Installation

### Global Installation (Recommended)

```bash
npm install -g cherrybridge
```

### Local Installation

```bash
npm install cherrybridge
npx cherrybridge --version
```

### Verify Installation

```bash
cherrybridge --version
```

You should see the version number. If you get a "command not found" error, make sure npm's global bin directory is in your PATH.

## Quick Start

The simplest workflow:

```bash
# Start cherry-picking PRs with a specific label
cherrybridge pick

# When prompted, enter the PR label (e.g., "feature:ABC-123")
# cherrybridge will:
#   1. Fetch all merged PRs with that label from development
#   2. Show you which PRs will be cherry-picked
#   3. Ask for confirmation
#   4. Cherry-pick them one by one onto a promotion branch
```

That's it! If there are no conflicts, you're done. If conflicts occur, see the [Conflict Resolution](#conflict-resolution) section.

## Commands

### `pick`

Start a new cherry-picking session. This command:

1. Fetches all merged PRs with the specified label from the source branch
2. Filters out PRs that have already been cherry-picked
3. Shows you a summary and asks for confirmation
4. Cherry-picks each PR merge commit one by one
5. Stops if a conflict occurs (you resolve it, then use `continue`)

**Basic usage:**
```bash
cherrybridge pick
```

**With flags:**
```bash
cherrybridge pick --label feature:ABC-123 --from development --to staging --via promote/abc-123
```

**Options:**
- `--from <branch>`: Source base branch PRs were merged into (default: `development`)
- `--to <branch>`: Target base branch to promote into (default: `staging`)
- `--label <label>`: Label used to group PRs (e.g., `feature:ABC-123`)
- `--via <branch>`: Branch to use for promotion (defaults to current branch)

**What happens:**
- If `--via` branch doesn't exist, it's created from the target branch
- If `--via` branch exists, you're checked out to it
- Config is stored on the branch for future `continue` commands
- You'll see ASCII art and a confirmation prompt before cherry-picking starts

### `continue`

Continue an in-progress cherry-pick or pick up newly-merged PRs. This command:

1. Continues any in-progress cherry-pick (if you resolved conflicts)
2. Re-fetches PRs from GitHub to catch any new merges
3. Cherry-picks any newly-merged PRs that weren't there before

**Basic usage:**
```bash
cherrybridge continue
```

**With flags:**
```bash
cherrybridge continue --label feature:ABC-123 --from development --to staging --via promote/abc-123
```

**Smart behavior:**
- If you're on a branch with stored config, it automatically uses those values (no prompts!)
- If config is incomplete, it prompts for missing values
- Command-line flags always override config values

**When to use:**
- After resolving conflicts from a `pick` command
- When new PRs with the same label have been merged into the source branch
- To resume a cherry-picking session

### `status`

Check which PRs are pending for cherry-picking. Shows:

- Total PRs found with the label
- How many are already picked
- List of pending PRs

**Basic usage:**
```bash
cherrybridge status
```

**With flags:**
```bash
cherrybridge status --label feature:ABC-123 --from development --to staging --via promote/abc-123
```

**Output example:**
```
Session: feature:ABC-123
From: development → To: staging
Promotion branch: promote/abc-123
PRs found: 5
Pending: 2

Pending PRs:
- #123: Add new feature (a1b2c3d4)
- #125: Fix bug (e5f6g7h8)
```

### `cancel`

Abort an in-progress cherry-pick. This runs `git cherry-pick --abort` to clean up the current cherry-pick operation.

**Usage:**
```bash
cherrybridge cancel
```

**Note:** This only aborts the current cherry-pick operation. It doesn't delete branches or affect already-completed cherry-picks.

## Advanced Usage

### Using Command-Line Flags

For automation or to avoid prompts, you can specify all options via flags:

```bash
cherrybridge pick \
  --label feature:ABC-123 \
  --from development \
  --to staging \
  --via promote/abc-123
```

This skips all prompts (except the confirmation before cherry-picking starts).

### Branch Config Storage

cherrybridge automatically stores configuration per branch using Git's branch-specific config. This means:

- After running `pick`, your settings are remembered
- Running `continue` on the same branch automatically uses stored config
- No manual config files to manage
- Config is local only (not pushed to GitHub)

**How it works:**
- Config is stored when you run `pick` or `continue`
- Stored values: `label`, `fromBranch`, `toBranch`
- Accessed via: `git config branch.<branch-name>.cherrybridge.*`

**Example:**
```bash
# First time - enter values
cherrybridge pick --label feature:ABC-123
# Config stored on promotion branch

# Later - automatically uses config
cherrybridge continue
# No prompts needed!
```

### Working with Multiple Promotion Branches

You can have multiple promotion branches for different labels:

```bash
# First promotion branch
cherrybridge pick --label feature:ABC-123 --via promote/abc-123

# Second promotion branch (different label)
cherrybridge pick --label bugfix:XYZ-456 --via promote/xyz-456
```

Each branch maintains its own config, so `continue` knows which label to use.

### Custom Source/Target Branches

By default, cherrybridge assumes `development` → `staging`, but you can use any branches:

```bash
cherrybridge pick \
  --label release:v1.0.0 \
  --from staging \
  --to production \
  --via promote/v1.0.0
```

## Conflict Resolution

When a conflict occurs during cherry-picking, cherrybridge stops immediately and shows clear instructions.

### What Happens

1. Cherry-pick stops at the conflicting commit
2. You see a message indicating which PR caused the conflict
3. Instructions are displayed for resolving it

### Step-by-Step Resolution

**1. Identify conflicted files:**
```bash
git status
```

**2. Open conflicted files and resolve conflicts:**
- Look for conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
- Edit files to resolve conflicts
- Remove conflict markers
- Save files

**3. Stage resolved files:**
```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Or stage all resolved files
git add .
```

**4. Continue cherry-picking:**
```bash
cherrybridge continue
```

cherrybridge will:
- Continue the current cherry-pick
- Then check for any newly-merged PRs and cherry-pick those too

### Aborting a Cherry-Pick

If you want to abort the entire cherry-pick operation:

```bash
cherrybridge cancel
```

This runs `git cherry-pick --abort` and cleans up the in-progress state.

### Example Conflict Workflow

```bash
# Start cherry-picking
cherrybridge pick --label feature:ABC-123

# Conflict occurs on PR #123
# Output shows:
# ⚠️ Conflict encountered on PR #123 (a1b2c3d4).
#
# To resolve:
# 1. Fix the conflicts in the files (remove conflict markers)
# 2. Stage the resolved files: git add <file>
# 3. Continue: cherrybridge continue

# Fix conflicts in your editor
vim src/file.ts

# Stage resolved files
git add src/file.ts

# Continue
cherrybridge continue
# ✅ Continues cherry-picking remaining PRs
```

## Tips and Best Practices

### When to Use Flags vs Prompts

**Use flags when:**
- Automating in scripts
- You know all values upfront
- You want to avoid any prompts

**Use prompts when:**
- Running interactively
- You're not sure of exact values
- You want cherrybridge to remember settings (config storage)

### Branch Naming Conventions

While cherrybridge doesn't enforce naming, consider:

- `promote/<label-sanitized>`: Clear and organized
- `promote/<feature-name>`: Descriptive
- `staging-pr/<ticket-number>`: Team convention

The `--via` flag lets you use any branch name.

### Working with Multiple Labels

If you have multiple labels to promote:

```bash
# Promote feature PRs
cherrybridge pick --label feature:ABC-123 --via promote/features

# Promote bugfix PRs (separate branch)
cherrybridge pick --label bugfix:XYZ-456 --via promote/bugfixes
```

Each branch maintains separate config, so `continue` works independently.

### Troubleshooting

**"Command not found: cherrybridge"**
- Make sure you installed globally: `npm install -g cherrybridge`
- Check your PATH includes npm's global bin directory
- Try using `npx cherrybridge` if installed locally

**"GitHub CLI (gh) is required"**
- Install GitHub CLI: https://cli.github.com/
- Authenticate: `gh auth login`

**"Working tree is not clean"**
- Commit or stash your changes first
- Exception: `continue` allows dirty working tree if you're resolving conflicts

**"Not in a git repository"**
- Run cherrybridge from within a git repository
- Make sure you're in the repo root or a subdirectory

**Config not being used**
- Make sure you're on the branch where config was stored
- Check config exists: `git config branch.<branch-name>.cherrybridge.label`
- Use `--via` flag to specify the branch explicitly

**PRs not being detected**
- Ensure PRs were merged (not closed) into the source branch
- Verify PRs have the correct label
- cherrybridge supports both "Create a merge commit" and "Squash and merge" strategies
- Rebase and merge may not work reliably (commits are replayed individually)
- Run `gh pr list --state merged --base development --label feature:ABC-123` to verify

## How It Works

### Commit Detection

cherrybridge uses Git's `-x` flag when cherry-picking and automatically detects the commit type:

**For merge commits:**
```bash
git cherry-pick -m 1 -x <merge-commit-sha>
```

**For squash commits:**
```bash
git cherry-pick -x <squash-commit-sha>
```

The `-x` flag adds `(cherry picked from commit <sha>)` to the commit message. cherrybridge then searches commit messages to detect which PRs have already been cherry-picked, avoiding duplicates.

cherrybridge detects commit type using `git rev-list --parents`:
- 3 hashes = merge commit (uses `-m 1`)
- 2 hashes = regular commit/squash (no `-m` flag)

### PR Fetching

Every time you run `pick` or `continue`, cherrybridge:

1. Runs `git fetch --all --prune` to update local refs
2. Uses `gh pr list` to fetch merged PRs with the specified label
3. Uses the `mergeCommit` field (populated for both merge and squash merges)
4. Sorts PRs by merge time (oldest first)

### Branch Config Storage

Config is stored using Git's branch-specific configuration:

```bash
git config branch.promote/abc-123.cherrybridge.label "feature:ABC-123"
git config branch.promote/abc-123.cherrybridge.fromBranch "development"
git config branch.promote/abc-123.cherrybridge.toBranch "staging"
```

This is:
- Local only (not pushed to GitHub)
- Branch-specific (each branch has its own config)
- Automatic (no manual management needed)

### Merge Strategy Support

cherrybridge supports multiple merge strategies:

**Merge Commits (Create a merge commit):**
- Uses `git cherry-pick -m 1 -x` to select the first parent (PR side)
- Works seamlessly with merge commits

**Squash Merges (Squash and merge):**
- Automatically detects squash commits (single-parent commits)
- Uses `git cherry-pick -x` without the `-m` flag
- GitHub provides the squash commit SHA in the `mergeCommit` field

**Rebase and Merge:**
- May not work reliably as commits are replayed individually
- No single commit SHA represents the entire PR

cherrybridge automatically detects the commit type and uses the appropriate cherry-pick command.

## Development

For contributors or local development:

```bash
# Clone the repository
git clone <repo-url>
cd cherrybridge

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link
```

After linking, you can test your changes locally using `cherrybridge` commands.

## Examples

### Complete Workflow Example

```bash
# 1. Start cherry-picking
cherrybridge pick --label feature:ABC-123
# Enter branch name when prompted: promote/abc-123
# Confirm cherry-picking 3 PRs

# 2. Conflict occurs on PR #123
# Fix conflicts, then:
git add .
cherrybridge continue

# 3. Check status
cherrybridge status
# Shows: 2 PRs pending

# 4. Continue (picks remaining PRs)
cherrybridge continue
# ✅ Done! All PRs cherry-picked

# 5. Push and create PR
git push -u origin promote/abc-123
gh pr create --base staging --head promote/abc-123
```

### Using All Flags

```bash
cherrybridge pick \
  --label release:v2.0.0 \
  --from staging \
  --to production \
  --via promote/v2.0.0
```

### Checking Status Before Starting

```bash
# Check what would be cherry-picked
cherrybridge status --label feature:ABC-123

# Then start if you're happy with the list
cherrybridge pick --label feature:ABC-123
```

### Resuming After New PRs Merge

```bash
# Initial cherry-pick
cherrybridge pick --label feature:ABC-123

# Later, new PRs merge with same label
cherrybridge continue
# Automatically detects and cherry-picks new PRs
```

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
