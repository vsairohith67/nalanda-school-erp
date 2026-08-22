# Codex Parallel Thread Template

Paste this preamble near the start of any future parallel feature prompt:

```text
PARALLEL WORKTREE SAFETY

One Codex thread = one Git worktree.

Do not switch branches in another worktree.
Create or use a dedicated worktree for this thread.
Verify the physical path and branch before editing.
Never commit, stash, discard, clean, reset, or move another workstream's dirty files.

Before editing, run:
git status --short --branch
git branch --show-current
git worktree list --porcelain

If the correct dedicated worktree does not exist, use:
node tools\dev-parallel\worktree-manager.mjs new <workstream-name>

Open the new Codex thread using the exact folder printed by the helper.
If asked to “Commit changes to switch branch,” cancel first and inspect worktree ownership.
Before QA, run:
node tools\dev-parallel\worktree-manager.mjs prepare-qa <expected-feature-branch>
```

Replace the placeholders only after the worktree helper confirms the final folder and branch.
