# Parallel Codex Worktree Guide

## The one rule

**One Codex thread = one Git worktree.**

A worktree is a separate physical project folder connected to the same Git repository. Each parallel Codex thread should have its own folder and its own branch. This keeps one thread's unfinished files away from every other thread.

## Why the branch-switch popup appears

Git normally uses one branch in one folder. If that folder contains unfinished changes and another thread tries to switch it to a different branch, those files may not match the new branch. Codex or Git may then ask you to “Commit changes to switch branch.”

That popup is a warning that two pieces of work may be sharing one physical folder. It does not mean that all visible files belong in one commit.

If the popup appears, **cancel first**. Do not click a button that commits everything, stashes everything, or discards anything. Check which folder and branch each thread is using.

## Create a worktree for a new parallel thread

Open Command Prompt at the repository root and run:

For a person using Command Prompt, run the interactive wrapper and type the name when asked:

```bat
tools\dev-parallel\worktree-new.cmd
```

Codex and other automation should pass an argument directly to Node so Windows Command Prompt never reparses untrusted argument text:

```bat
node tools\dev-parallel\worktree-manager.mjs new universal-search-1a
```

The helper:

- fetches the latest `origin/main`;
- converts the name to a safe `feature/...` branch;
- creates a sibling worktree folder outside the main repository;
- refuses an existing branch, existing directory, unsafe name, or nested path;
- prints the new folder, branch, and exact base commit;
- never switches the branch in the folder where it was called.

Example result using generic paths:

```text
Path: C:\Projects\school-software-worktrees\universal-search-1a
Branch: feature/universal-search-1a
Base: origin/main (0123456789abcdef...)
Open a new Codex thread using this worktree.
```

Start the new Codex thread with the printed folder as its working directory. Do not point the new thread at the original repository folder.

Use short ASCII names made from letters, numbers, spaces, dots, underscores, or dashes. The helper safely converts spaces, dots, and underscores to dashes. It rejects path fragments, shell symbols, quotes, Unicode lookalikes, leading dashes, and absolute paths instead of guessing.

## Confirm which folder belongs to which branch

Run:

```bat
tools\dev-parallel\worktree-list.cmd
```

The output connects every registered physical directory to its checked-out branch and labels it `CLEAN`, `DIRTY`, `STALE`, `MISSING`, or `UNREADABLE`. The `CURRENT` label shows the folder from which you ran the command.

For a deeper check of the current folder, run:

```bat
tools\dev-parallel\worktree-doctor.cmd
```

`SAFE` means no warning was found. `WARNING` means work is present or a relationship needs review. `BLOCKED` means a detached head, conflict, duplicate checkout, or missing base must be resolved before continuing. Doctor only inspects; it does not alter commits or files.

## Before asking for QA

Commit only the files that belong to the current workstream, then run:

```bat
node tools\dev-parallel\worktree-manager.mjs prepare-qa feature/universal-search-1a
```

The command fetches origin and checks the expected branch, cleanliness, conflicts, upstream, implementation commits, relationship to `origin/main`, and detectable overlap with dirty files in another worktree. If files remain, it blocks and lists them. It does not offer to commit everything.

Committing is appropriate when you have reviewed the exact diff, every file belongs to this branch, focused checks pass, and the commit message describes this workstream. A branch-switch popup is not evidence that committing all files is appropriate.

## Inspect a suspicious earlier commit or checkout

Run:

```bat
tools\dev-parallel\lineage-audit.cmd
```

The lineage audit reads branch heads, upstream relationships, merge bases, recent HEAD reflog activity, local-only commits, and reachability clues. Its labels are conservative:

- `LIKELY_NORMAL`: no suspicious clue was found in the inspected evidence;
- `REVIEW_LOCAL_COMMIT`: a commit is not yet in its configured upstream;
- `MIXED_WORKSTREAM_RISK`: recent checkout activity and local-only work coexist;
- `ORPHANED_COMMIT_FOUND`: a recent reflog commit is not reachable from a current ref;
- `UNKNOWN`: the available evidence is insufficient.

These labels do not declare a commit corrupt and never repair history automatically.

## Why automatic stash is not recommended

A stash is stored in the shared repository, not in a clearly named worktree folder. With several parallel threads, it can be difficult to know who created it, which branch it belongs to, and whether applying it will mix unrelated files. A dedicated worktree keeps ownership visible through its folder and branch.

## Check an old worktree before removing it

From a different registered worktree, run:

```bat
node tools\dev-parallel\worktree-manager.mjs cleanup-check "C:\Projects\school-software-worktrees\old-feature"
```

`SAFE_TO_REMOVE` requires a clean folder, no untracked files, a fully pushed same-named branch, a commit included in `origin/main`, and a target that is not the current worktree. If the user has explicitly decided that an unmerged but fully pushed branch is disposable, add `--disposable`.

The command is only an evaluator. It never removes a worktree, deletes a branch, stashes files, rewrites commits, or discards data. If it reports `NOT_SAFE_TO_REMOVE`, inspect the reasons and preserve the folder.

## Automation-friendly output

Every main command supports `--json`, for example:

```bat
node tools\dev-parallel\worktree-manager.mjs list --json
```

Blocked or invalid operations return a nonzero exit code. Readable warning-only doctor or lineage results remain non-destructive and return normally.
