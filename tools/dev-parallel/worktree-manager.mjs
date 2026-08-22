#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const REMOTE = "origin";
const DEFAULT_BASE = "origin/main";
const EXIT_BLOCKED = 2;

class CliError extends Error {
  constructor(message, exitCode = EXIT_BLOCKED) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

let resolvedGitExecutable;

function trustedGitExecutable() {
  if (resolvedGitExecutable) return resolvedGitExecutable;
  const rawPath = process.env.PATH || process.env.Path || "";
  const executableName = process.platform === "win32" ? "git.exe" : "git";
  const currentDirectory = normalizedPath(process.cwd());
  const currentRoot = normalizedPath(path.parse(process.cwd()).root);
  for (const rawEntry of rawPath.split(path.delimiter)) {
    const entry = rawEntry.trim().replace(/^"|"$/g, "");
    if (!entry || !path.isAbsolute(entry)) continue;
    const candidate = path.join(entry, executableName);
    if (!existsSync(candidate)) continue;
    const canonical = realpathSync.native(candidate);
    const canonicalDirectory = normalizedPath(path.dirname(canonical));
    if (currentDirectory !== currentRoot && isPathInside(canonical, currentDirectory)) continue;
    if (!statSync(canonical).isFile()) continue;
    resolvedGitExecutable = canonical;
    return resolvedGitExecutable;
  }
  throw new CliError("A trusted Git executable was not found in an absolute PATH directory.");
}

function commandResult(command, args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });

  if (result.error) {
    throw new CliError(`Unable to run ${command}: ${result.error.message}`);
  }

  const status = result.status ?? 1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (status !== 0 && !allowFailure) {
    const detail = stderr.trim() || stdout.trim() || `exit ${status}`;
    throw new CliError(`${command} ${args[0] ?? ""} failed: ${detail}`);
  }

  return { status, stdout, stderr };
}

function git(args, cwd, options) {
  return commandResult(trustedGitExecutable(), args, cwd, options);
}

function gitText(args, cwd, options) {
  return git(args, cwd, options).stdout.trim();
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  const canonical = existsSync(resolved) ? realpathSync.native(resolved) : resolved;
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

function samePath(left, right) {
  return normalizedPath(left) === normalizedPath(right);
}

function isPathInside(candidate, parent) {
  const child = normalizedPath(candidate);
  const root = normalizedPath(parent);
  const relative = path.relative(root, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseWorktreePorcelain(raw) {
  const records = [];
  let current = null;
  for (const token of raw.split("\0")) {
    if (!token) {
      if (current) records.push(current);
      current = null;
      continue;
    }
    const separator = token.indexOf(" ");
    const key = separator === -1 ? token : token.slice(0, separator);
    const value = separator === -1 ? "" : token.slice(separator + 1);
    if (key === "worktree") current = { path: value };
    if (!current) continue;
    if (key === "HEAD") current.head = value;
    if (key === "branch") {
      current.branchRef = value;
      current.branch = value.replace(/^refs\/heads\//, "");
    }
    if (key === "detached") current.detached = true;
    if (key === "bare") current.bare = true;
    if (key === "locked") current.locked = value || true;
    if (key === "prunable") current.prunable = value || true;
  }
  if (current) records.push(current);
  return records;
}

function repositoryContext(cwd = process.cwd()) {
  const probe = git(["rev-parse", "--show-toplevel"], cwd, { allowFailure: true });
  if (probe.status !== 0) {
    throw new CliError("This command must be run inside a Git working tree.");
  }
  const root = path.resolve(probe.stdout.trim());
  const raw = gitText(["worktree", "list", "--porcelain", "-z"], root);
  const worktrees = parseWorktreePorcelain(`${raw}\0`);
  if (worktrees.length === 0) throw new CliError("Git did not report any worktrees.");
  const mainWorktree = worktrees[0];
  return { root, worktrees, mainWorktree };
}

function currentBranch(cwd) {
  const result = git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd, {
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function refExists(cwd, ref) {
  return git(["show-ref", "--verify", "--quiet", ref], cwd, {
    allowFailure: true,
  }).status === 0;
}

function resolveCommit(cwd, ref) {
  const result = git(["rev-parse", "--verify", `${ref}^{commit}`], cwd, {
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function upstreamFor(cwd, ref = "HEAD") {
  const expression = ref === "HEAD" ? "@{upstream}" : `${ref}@{upstream}`;
  const result = git(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", expression],
    cwd,
    { allowFailure: true },
  );
  return result.status === 0 ? result.stdout.trim() : null;
}

function aheadBehind(cwd, left, right) {
  const result = git(
    ["rev-list", "--left-right", "--count", `${left}...${right}`],
    cwd,
    { allowFailure: true },
  );
  if (result.status !== 0) return null;
  const [ahead, behind] = result.stdout.trim().split(/\s+/).map(Number);
  return { ahead, behind };
}

function statusEntries(cwd) {
  const result = git(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    cwd,
    { allowFailure: true },
  );
  if (result.status !== 0) return null;
  const tokens = result.stdout.split("\0");
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const status = token.slice(0, 2);
    const paths = [token.slice(3)];
    if (/[RC]/.test(status) && tokens[index + 1]) paths.push(tokens[++index]);
    entries.push({ status, paths });
  }
  return entries;
}

function statusLines(cwd) {
  const entries = statusEntries(cwd);
  if (entries === null) return null;
  return entries.map((entry) => `${entry.status} ${entry.paths.join(" -> ")}`);
}

function dirtyPaths(cwd) {
  const entries = statusEntries(cwd);
  if (entries === null) return null;
  return entries.flatMap((entry) => entry.paths.map((item) => item.replaceAll("\\", "/")));
}

function unresolvedPaths(cwd) {
  const result = git(["diff", "--name-only", "--diff-filter=U"], cwd, {
    allowFailure: true,
  });
  return result.status === 0
    ? result.stdout.split(/\r?\n/).filter(Boolean)
    : ["unable-to-inspect-conflicts"];
}

function isAncestor(cwd, ancestor, descendant) {
  return git(["merge-base", "--is-ancestor", ancestor, descendant], cwd, {
    allowFailure: true,
  }).status === 0;
}

function validateWorkstreamName(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new CliError("A workstream name is required.");
  }
  if (input !== input.trim()) {
    throw new CliError("Workstream names cannot start or end with spaces.");
  }
  if (input.length > 64) throw new CliError("Workstream names must be 64 characters or fewer.");
  if (path.isAbsolute(input) || path.win32.isAbsolute(input) || path.posix.isAbsolute(input)) {
    throw new CliError("Absolute paths are not valid workstream names.");
  }
  if (input.startsWith("-")) throw new CliError("Workstream names cannot start with a dash.");
  if (input.includes("..")) throw new CliError("Path traversal is not allowed in workstream names.");
  if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(input)) {
    throw new CliError(
      "Use ASCII letters, numbers, spaces, dots, underscores or dashes only; shell and path characters are refused.",
    );
  }
  const slug = input
    .toLowerCase()
    .replace(/[ ._]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new CliError("The workstream name could not be converted to a safe name.");
  }
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) {
    throw new CliError("Windows-reserved device names are not valid workstream names.");
  }
  return slug;
}

function validateBranchName(input, cwd) {
  if (!input || input.startsWith("-") || input.includes("..")) {
    throw new CliError("The expected branch name is unsafe.");
  }
  const result = git(["check-ref-format", "--branch", input], cwd, {
    allowFailure: true,
  });
  if (result.status !== 0) throw new CliError(`Invalid branch name: ${input}`);
  return input;
}

function defaultWorktreeParent(mainWorktreePath) {
  const folderName = path.basename(mainWorktreePath);
  const safeFolderName = folderName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (!safeFolderName) throw new CliError("The main repository folder name is not usable.");
  return path.join(path.dirname(mainWorktreePath), `${safeFolderName}-worktrees`);
}

function inspectWorktree(record, currentRoot, mainPath) {
  let state = "CLEAN";
  let uncommitted = 0;
  let untracked = 0;
  if (record.prunable) state = "STALE";
  else if (!existsSync(record.path)) state = "MISSING";
  else if (record.bare) state = "BARE";
  else {
    const lines = statusLines(record.path);
    if (lines === null) state = "UNREADABLE";
    else {
      uncommitted = lines.length;
      untracked = lines.filter((line) => line.startsWith("??")).length;
      if (uncommitted > 0) state = "DIRTY";
    }
  }
  return {
    ...record,
    role: samePath(record.path, mainPath) ? "MAIN WORKTREE" : "PARALLEL WORKTREE",
    current: samePath(record.path, currentRoot),
    state,
    uncommitted,
    untracked,
  };
}

function collectWorktreeStatus(context) {
  return context.worktrees.map((record) =>
    inspectWorktree(record, context.root, context.mainWorktree.path),
  );
}

function doctor(cwd = process.cwd()) {
  const context = repositoryContext(cwd);
  const branch = currentBranch(context.root);
  const inspectedLines = statusLines(context.root);
  const lines = inspectedLines ?? [];
  const conflicts = unresolvedPaths(context.root);
  const untracked = lines.filter((line) => line.startsWith("??"));
  const upstream = branch ? upstreamFor(context.root) : null;
  const originMain = resolveCommit(context.root, DEFAULT_BASE);
  const comparison = upstream || (originMain ? DEFAULT_BASE : null);
  const relationship = branch && comparison ? aheadBehind(context.root, "HEAD", comparison) : null;
  const worktrees = collectWorktreeStatus(context);
  const staleDryRun = git(
    ["worktree", "prune", "--dry-run", "--verbose"],
    context.root,
    { allowFailure: true },
  );
  const stale = worktrees.filter((item) => item.prunable || item.state === "MISSING");
  const duplicateBranch = branch
    ? worktrees.filter((item) => item.branch === branch && !item.current)
    : [];
  const reasons = [];
  let status = "SAFE";
  const block = (message) => {
    status = "BLOCKED";
    reasons.push(message);
  };
  const warn = (message) => {
    if (status === "SAFE") status = "WARNING";
    reasons.push(message);
  };

  if (!branch) block("HEAD is detached.");
  if (inspectedLines === null) block("Working-tree status could not be read.");
  if (!originMain) block("origin/main is unavailable; fetch or remote repair is required.");
  if (branch && comparison && relationship === null) block(`Ahead/behind state versus ${comparison} could not be determined.`);
  if (conflicts.length > 0) block(`Unresolved conflicts: ${conflicts.join(", ")}`);
  if (duplicateBranch.length > 0) {
    block(`Branch ${branch} also appears checked out at ${duplicateBranch.map((item) => item.path).join(", ")}.`);
  }
  if (lines.length > 0) warn(`Working tree has ${lines.length} uncommitted path(s).`);
  if (untracked.length > 0) warn(`Working tree has ${untracked.length} untracked path(s).`);
  if (branch && !upstream) warn(`Branch ${branch} has no upstream.`);
  if (relationship?.ahead > 0) warn(`Branch has ${relationship.ahead} local-only commit(s) versus ${comparison}.`);
  if (relationship?.behind > 0) warn(`Branch is behind ${comparison} by ${relationship.behind} commit(s).`);
  if (stale.length > 0 || staleDryRun.stdout.trim()) {
    warn("Stale worktree metadata is present; inspect it before pruning.");
  }
  if (reasons.length === 0) reasons.push("No worktree, branch or lineage warning was detected.");

  return {
    command: "doctor",
    status,
    repositoryRoot: context.root,
    branch,
    detached: !branch,
    clean: inspectedLines !== null && lines.length === 0,
    uncommitted: lines.length,
    untracked: untracked.length,
    upstream,
    comparison,
    ahead: relationship?.ahead ?? null,
    behind: relationship?.behind ?? null,
    originMain,
    staleWorktrees: stale.map((item) => item.path),
    worktrees,
    reasons,
    exitCode: status === "BLOCKED" ? EXIT_BLOCKED : 0,
  };
}

function newWorktree(name, cwd = process.cwd()) {
  const slug = validateWorkstreamName(name);
  const context = repositoryContext(cwd);
  const branch = `feature/${slug}`;
  validateBranchName(branch, context.root);

  const fetch = git(["fetch", REMOTE, "--prune"], context.root, {
    allowFailure: true,
  });
  if (fetch.status !== 0) {
    throw new CliError(`Fetch from origin failed: ${fetch.stderr.trim() || "unknown error"}`);
  }
  const baseSha = resolveCommit(context.root, DEFAULT_BASE);
  if (!baseSha) throw new CliError("origin/main does not resolve to a commit after fetch.");

  const refreshed = repositoryContext(context.root);
  const checkedOut = refreshed.worktrees.find((item) => item.branch === branch);
  if (checkedOut) {
    throw new CliError(`Branch ${branch} is already checked out at ${checkedOut.path}.`);
  }
  if (refExists(context.root, `refs/heads/${branch}`)) {
    throw new CliError(`Local branch ${branch} already exists. Inspect it; it will not be reused automatically.`);
  }
  if (refExists(context.root, `refs/remotes/${REMOTE}/${branch}`)) {
    throw new CliError(`Remote branch ${REMOTE}/${branch} already exists. Inspect it; it will not be reused automatically.`);
  }

  const parent = defaultWorktreeParent(refreshed.mainWorktree.path);
  const target = path.join(parent, slug);
  if (refreshed.worktrees.some((item) => isPathInside(target, item.path))) {
    throw new CliError("The derived path would be inside an existing Git worktree.");
  }
  if (existsSync(target)) {
    throw new CliError(`Target directory already exists: ${target}. Inspect it; nothing was overwritten.`);
  }
  if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) {
    throw new CliError(`The worktree parent is a symbolic link and was refused: ${parent}`);
  }
  mkdirSync(parent, { recursive: true });

  const add = git(
    ["worktree", "add", "-b", branch, target, baseSha],
    context.root,
    { allowFailure: true },
  );
  if (add.status !== 0) {
    throw new CliError(
      `Worktree creation failed without switching the caller: ${add.stderr.trim() || add.stdout.trim()}`,
    );
  }

  const createdBranch = currentBranch(target);
  const createdHead = resolveCommit(target, "HEAD");
  const createdStatus = statusLines(target);
  if (createdBranch !== branch || createdHead !== baseSha || createdStatus === null || createdStatus.length > 0) {
    throw new CliError(
      `Git created the worktree, but verification needs review. Path: ${target}`,
    );
  }

  return {
    command: "new",
    status: "SAFE",
    path: target,
    branch,
    base: DEFAULT_BASE,
    baseSha,
    instruction: "Open a new Codex thread using this worktree.",
    exitCode: 0,
  };
}

function listWorktrees(cwd = process.cwd()) {
  const context = repositoryContext(cwd);
  return {
    command: "list",
    status: "SAFE",
    repositoryRoot: context.root,
    worktrees: collectWorktreeStatus(context),
    exitCode: 0,
  };
}

function localBranchAudits(cwd) {
  const originMain = resolveCommit(cwd, DEFAULT_BASE);
  const raw = gitText(
    [
      "for-each-ref",
      "--format=%(refname:short)%09%(upstream:short)%09%(objectname)",
      "refs/heads",
    ],
    cwd,
  );
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [branch, upstream, head] = line.split("\t");
      const comparison = upstream || (originMain ? DEFAULT_BASE : null);
      const relationship = comparison ? aheadBehind(cwd, branch, comparison) : null;
      return {
        branch,
        upstream: upstream || null,
        comparison,
        head,
        ahead: relationship?.ahead ?? null,
        behind: relationship?.behind ?? null,
      };
    });
}

function lineage(cwd = process.cwd()) {
  const context = repositoryContext(cwd);
  const branch = currentBranch(context.root);
  const head = resolveCommit(context.root, "HEAD");
  const upstream = branch ? upstreamFor(context.root) : null;
  const relationship = upstream ? aheadBehind(context.root, "HEAD", upstream) : null;
  const originMain = resolveCommit(context.root, DEFAULT_BASE);
  const baseRelationship = originMain ? aheadBehind(context.root, "HEAD", DEFAULT_BASE) : null;
  const mergeBase = originMain
    ? gitText(["merge-base", "HEAD", DEFAULT_BASE], context.root, { allowFailure: true }) || null
    : null;
  const reflogRaw = git(
    ["reflog", "show", "HEAD", "-n", "30", "--date=iso-strict", "--format=%H%x09%gd%x09%gs"],
    context.root,
    { allowFailure: true },
  );
  const reflog = reflogRaw.status === 0
    ? reflogRaw.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
        const [sha, selector, ...subject] = line.split("\t");
        return { sha, selector, subject: subject.join("\t") };
      })
    : [];
  const checkoutEvents = reflog.filter((item) => item.subject.startsWith("checkout:"));
  const commitEvents = reflog.filter((item) => /^(commit|merge|rebase)( \([^)]*\))?:/.test(item.subject));
  const branchAudits = localBranchAudits(context.root);
  const localOnlyBranches = branchAudits.filter((item) => (item.ahead ?? 0) > 0);
  const localComparison = upstream || (originMain ? DEFAULT_BASE : null);
  const localCommitProbe = localComparison
    ? git(["log", "--format=%H%x09%s", `${localComparison}..HEAD`], context.root, {
        allowFailure: true,
      })
    : null;
  const localOnlyCommits = localCommitProbe?.status === 0
    ? localCommitProbe.stdout.trim().split(/\r?\n/).filter(Boolean)
    : [];
  const orphanedCommits = [];
  let containsProbeFailed = false;
  for (const entry of commitEvents.slice(0, 12)) {
    const containing = git(
      ["for-each-ref", "--contains", entry.sha, "--format=%(refname)"],
      context.root,
      { allowFailure: true },
    );
    if (containing.status === 0 && !containing.stdout.trim()) {
      orphanedCommits.push({ sha: entry.sha, subject: entry.subject });
    }
    if (containing.status !== 0) containsProbeFailed = true;
  }
  const headBranchProbe = head
    ? git(
        ["for-each-ref", "--contains", head, "--format=%(refname:short)", "refs/heads", "refs/remotes"],
        context.root,
        { allowFailure: true },
      )
    : null;
  const headBranches = headBranchProbe?.status === 0
    ? headBranchProbe.stdout.trim().split(/\r?\n/).filter(Boolean)
    : [];

  let classification = "LIKELY_NORMAL";
  const reasons = [];
  const evidenceIssues = [];
  if (!head) evidenceIssues.push("HEAD does not resolve to a commit.");
  if (!localComparison) evidenceIssues.push("Neither an upstream nor origin/main is available for comparison.");
  if (upstream && relationship === null) evidenceIssues.push(`Ahead/behind state versus ${upstream} could not be determined.`);
  if (originMain && baseRelationship === null) evidenceIssues.push("Ahead/behind state versus origin/main could not be determined.");
  if (originMain && !mergeBase) evidenceIssues.push("No merge base with origin/main could be established.");
  if (reflogRaw.status !== 0) evidenceIssues.push("The HEAD reflog could not be inspected.");
  if (localComparison && localCommitProbe?.status !== 0) evidenceIssues.push(`Local-only commits versus ${localComparison} could not be inspected.`);
  if (branchAudits.some((item) => !item.comparison)) evidenceIssues.push("One or more local branches have neither an upstream nor origin/main comparison.");
  if (branchAudits.some((item) => item.comparison && item.ahead === null)) evidenceIssues.push("One or more local branch comparisons could not be inspected.");
  if (containsProbeFailed) evidenceIssues.push("Reachability for one or more recent commits could not be inspected.");
  if (head && headBranchProbe?.status !== 0) evidenceIssues.push("Refs containing HEAD could not be inspected.");

  if (evidenceIssues.length > 0) {
    classification = "UNKNOWN";
    reasons.push(...evidenceIssues);
  } else if (orphanedCommits.length > 0) {
    classification = "ORPHANED_COMMIT_FOUND";
    reasons.push("A recent reflog commit is not currently reachable from a branch or remote ref; review before any repair.");
  } else if (checkoutEvents.length > 0 && localOnlyBranches.length > 0) {
    classification = "MIXED_WORKSTREAM_RISK";
    reasons.push("Recent checkout activity and local-only branch commits coexist; inspect their file scope and timing.");
  } else if (localOnlyCommits.length > 0 || localOnlyBranches.length > 0) {
    classification = "REVIEW_LOCAL_COMMIT";
    reasons.push("One or more commits are not yet present in their configured upstream.");
  } else if (!head || (!branch && reflog.length === 0)) {
    classification = "UNKNOWN";
    reasons.push("There is not enough reachable HEAD/reflog evidence for a confident classification.");
  } else {
    reasons.push("No orphaned or local-only commit clue was found in the inspected refs and recent HEAD reflog.");
  }
  reasons.push("These are conservative clues, not a claim that any commit is corrupt.");

  return {
    command: "lineage",
    status: classification,
    repositoryRoot: context.root,
    branch,
    detached: !branch,
    head,
    upstream,
    ahead: relationship?.ahead ?? null,
    behind: relationship?.behind ?? null,
    originMain,
    aheadOfOriginMain: baseRelationship?.ahead ?? null,
    behindOriginMain: baseRelationship?.behind ?? null,
    mergeBase,
    checkoutEvents,
    localOnlyCommits,
    localOnlyBranches,
    orphanedCommits,
    headReachableFrom: headBranches,
    recentReflog: reflog.slice(0, 12),
    reasons,
    exitCode: 0,
  };
}

function committedPaths(cwd, base) {
  const result = git(["diff", "--name-only", "-z", `${base}...HEAD`], cwd, {
    allowFailure: true,
  });
  return result.status === 0
    ? result.stdout.split("\0").filter(Boolean).map((item) => item.replaceAll("\\", "/"))
    : null;
}

function prepareQa(expectedBranch, cwd = process.cwd()) {
  const context = repositoryContext(cwd);
  const branch = currentBranch(context.root);
  if (expectedBranch) validateBranchName(expectedBranch, context.root);
  const expected = expectedBranch || branch;
  const reasons = [];
  const blockers = [];
  const warnings = [];

  const fetch = git(["fetch", REMOTE, "--prune"], context.root, {
    allowFailure: true,
  });
  if (fetch.status !== 0) blockers.push(`Fetch from origin failed: ${fetch.stderr.trim() || "unknown error"}`);
  const originMain = resolveCommit(context.root, DEFAULT_BASE);
  if (!originMain) blockers.push("origin/main is unavailable.");
  if (!branch) blockers.push("HEAD is detached.");
  if (expected && branch && branch !== expected) {
    blockers.push(`Expected branch ${expected}, but this worktree is on ${branch}.`);
  }
  const lines = statusLines(context.root);
  if (lines === null) blockers.push("Working-tree status could not be read.");
  else if (lines.length > 0) {
    blockers.push(`Working tree is dirty: ${lines.length} path(s) remain.`);
    reasons.push(...lines.map((line) => `Remaining: ${line}`));
  }
  const conflicts = unresolvedPaths(context.root);
  if (conflicts.length > 0) blockers.push(`Unresolved conflicts: ${conflicts.join(", ")}`);
  const upstream = branch ? upstreamFor(context.root) : null;
  if (!upstream && branch) warnings.push(`Branch ${branch} has no upstream; push it explicitly before handoff.`);
  if (upstream && branch && upstream !== `${REMOTE}/${branch}`) {
    warnings.push(`Upstream is ${upstream}, not ${REMOTE}/${branch}; the feature branch may not be pushed yet.`);
  }

  const mergeBaseProbe = originMain
    ? git(["merge-base", "HEAD", DEFAULT_BASE], context.root, { allowFailure: true })
    : null;
  const mergeBase = mergeBaseProbe?.status === 0 ? mergeBaseProbe.stdout.trim() || null : null;
  if (originMain && !mergeBase) blockers.push("No merge base with origin/main could be established.");
  const baseCounts = originMain ? aheadBehind(context.root, "HEAD", DEFAULT_BASE) : null;
  if (originMain && baseCounts === null) blockers.push("Ahead/behind state versus origin/main could not be determined.");
  const branchAhead = baseCounts?.ahead ?? null;
  const mainAhead = baseCounts?.behind ?? null;
  if (branchAhead === 0) blockers.push("No implementation commit exists beyond origin/main.");
  if ((mainAhead ?? 0) > 0) warnings.push(`origin/main has ${mainAhead} commit(s) not in this branch; reconcile before release.`);

  const inspectedChangedPaths = originMain ? committedPaths(context.root, DEFAULT_BASE) : [];
  if (originMain && inspectedChangedPaths === null) blockers.push("Committed paths versus origin/main could not be inspected.");
  const changedPaths = inspectedChangedPaths ?? [];
  const changedSet = new Set(changedPaths);
  const overlap = [];
  const unreadableWorktrees = [];
  for (const item of context.worktrees) {
    if (samePath(item.path, context.root) || !existsSync(item.path)) continue;
    const otherDirtyPaths = dirtyPaths(item.path);
    if (otherDirtyPaths === null) {
      unreadableWorktrees.push(item.path);
      continue;
    }
    for (const dirtyPath of otherDirtyPaths) {
      if (changedSet.has(dirtyPath)) overlap.push(`${dirtyPath} (${item.path})`);
    }
  }
  if (unreadableWorktrees.length > 0) {
    blockers.push(`Status could not be read for other worktree(s): ${unreadableWorktrees.join(", ")}. Cross-worktree overlap is unverified.`);
  }
  if (overlap.length > 0) {
    blockers.push(`Committed paths overlap dirty files in another worktree: ${overlap.join(", ")}`);
  }

  const status = blockers.length > 0 ? "BLOCKED" : "SAFE";
  reasons.unshift(...blockers, ...warnings);
  if (reasons.length === 0) reasons.push("Branch is clean, attached, implemented and related to current origin/main.");
  return {
    command: "prepare-qa",
    status,
    repositoryRoot: context.root,
    branch,
    expectedBranch: expected,
    clean: lines?.length === 0,
    upstream,
    originMain,
    mergeBase,
    branchAhead,
    mainAhead,
    changedPaths,
    crossWorktreeOverlap: overlap,
    unreadableWorktrees,
    warnings,
    blockers,
    reasons,
    exitCode: status === "BLOCKED" ? EXIT_BLOCKED : 0,
  };
}

function registeredTarget(context, requestedPath) {
  const target = path.resolve(context.root, requestedPath);
  const match = context.worktrees.find((item) => samePath(item.path, target));
  if (!match) throw new CliError(`Path is not a registered Git worktree: ${target}`);
  return match;
}

function cleanupCheck(requestedPath, disposable, cwd = process.cwd()) {
  const context = repositoryContext(cwd);
  const record = registeredTarget(context, requestedPath || context.root);
  const reasons = [];
  let safe = true;
  const refuse = (message) => {
    safe = false;
    reasons.push(message);
  };

  const fetch = git(["fetch", REMOTE, "--prune"], context.root, {
    allowFailure: true,
  });
  if (fetch.status !== 0) {
    refuse(`Fetch from origin failed; cleanup lineage is not current: ${fetch.stderr.trim() || "unknown error"}`);
  }

  if (samePath(record.path, context.root)) refuse("The current worktree cannot be removed while this command is running from it.");
  if (!existsSync(record.path)) refuse("The worktree directory is missing; inspect stale metadata manually.");
  if (record.detached || !record.branch) refuse("The worktree has a detached HEAD.");
  const lines = existsSync(record.path) ? statusLines(record.path) : null;
  if (lines === null) refuse("Working-tree status could not be read.");
  else {
    const untracked = lines.filter((line) => line.startsWith("??"));
    if (lines.length > 0) refuse(`Worktree is dirty: ${lines.length} path(s), including ${untracked.length} untracked path(s).`);
  }

  const head = existsSync(record.path) ? resolveCommit(record.path, "HEAD") : record.head;
  const remoteRef = record.branch ? `refs/remotes/${REMOTE}/${record.branch}` : null;
  const remoteHead = remoteRef && refExists(context.root, remoteRef)
    ? resolveCommit(context.root, remoteRef)
    : null;
  const pushed = Boolean(head && remoteHead && isAncestor(context.root, head, remoteHead));
  if (!pushed) refuse("The branch is not fully pushed to its same-named origin branch.");
  const merged = Boolean(head && resolveCommit(context.root, DEFAULT_BASE) && isAncestor(context.root, head, DEFAULT_BASE));
  if (!merged && !disposable) refuse("The branch is not merged into origin/main; use --disposable only after an explicit user decision.");

  if (safe) reasons.push(disposable && !merged
    ? "Clean, pushed and explicitly marked disposable; no removal was performed."
    : "Clean, pushed and merged into origin/main; no removal was performed.");
  return {
    command: "cleanup-check",
    status: safe ? "SAFE_TO_REMOVE" : "NOT_SAFE_TO_REMOVE",
    path: record.path,
    branch: record.branch ?? null,
    head,
    clean: lines?.length === 0,
    pushed,
    merged,
    disposable,
    originFetched: fetch.status === 0,
    reasons,
    exitCode: safe ? 0 : EXIT_BLOCKED,
  };
}

function printWorktreeList(result) {
  printHumanLine(`Repository: ${result.repositoryRoot}`);
  for (const item of result.worktrees) {
    printHumanLine("");
    printHumanLine(`${item.role}${item.current ? " (CURRENT)" : ""}`);
    printHumanLine(`Path: ${item.path}`);
    printHumanLine(`Branch: ${item.detached ? `(detached at ${item.head})` : item.branch ?? "(none)"}`);
    printHumanLine(`State: ${item.state}`);
    if (item.uncommitted > 0) printHumanLine(`Uncommitted: ${item.uncommitted} path(s)`);
    if (item.untracked > 0) printHumanLine(`Untracked: ${item.untracked} path(s)`);
    if (item.locked) printHumanLine(`Locked: ${item.locked}`);
    if (item.prunable) printHumanLine(`Stale metadata: ${item.prunable}`);
  }
}

function terminalSafe(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, (character) => {
    const codePoint = character.codePointAt(0).toString(16).padStart(4, "0");
    return `\\u${codePoint}`;
  });
}

function printHumanLine(value) {
  console.log(terminalSafe(value));
}

function printResult(result) {
  if (result.command === "list" || result.command === "status") {
    printWorktreeList(result);
    return;
  }
  if (result.command === "new") {
    printHumanLine(result.status);
    printHumanLine(`Path: ${result.path}`);
    printHumanLine(`Branch: ${result.branch}`);
    printHumanLine(`Base: ${result.base} (${result.baseSha})`);
    printHumanLine(result.instruction);
    return;
  }
  printHumanLine(result.status);
  if (result.repositoryRoot) printHumanLine(`Repository: ${result.repositoryRoot}`);
  if ("path" in result) printHumanLine(`Path: ${result.path}`);
  if ("branch" in result) printHumanLine(`Branch: ${result.branch ?? "(detached)"}`);
  if ("head" in result && result.head) printHumanLine(`HEAD: ${result.head}`);
  if ("upstream" in result) printHumanLine(`Upstream: ${result.upstream ?? "(none)"}`);
  if ("ahead" in result && result.ahead !== null) {
    printHumanLine(`Ahead/behind ${result.comparison ?? result.upstream ?? "comparison"}: ${result.ahead}/${result.behind}`);
  }
  if ("branchAhead" in result && result.branchAhead !== null) {
    printHumanLine(`Ahead/behind origin/main: ${result.branchAhead}/${result.mainAhead}`);
  }
  for (const reason of result.reasons ?? []) printHumanLine(`- ${reason}`);
  if (result.command === "lineage") {
    printHumanLine(`origin/main: ${result.originMain ?? "(unavailable)"}`);
    if (result.aheadOfOriginMain !== null) {
      printHumanLine(`Ahead/behind origin/main: ${result.aheadOfOriginMain}/${result.behindOriginMain}`);
    }
    printHumanLine(`Merge base: ${result.mergeBase ?? "(unavailable)"}`);
    printHumanLine(`Recent checkout events: ${result.checkoutEvents.length}`);
    for (const item of result.checkoutEvents) printHumanLine(`  ${item.sha.slice(0, 12)} ${item.selector} ${item.subject}`);
    printHumanLine(`Local-only commits: ${result.localOnlyCommits.length}`);
    for (const item of result.localOnlyCommits) printHumanLine(`  ${item}`);
    printHumanLine(`Local-only branches: ${result.localOnlyBranches.length}`);
    for (const item of result.localOnlyBranches) {
      printHumanLine(`  ${item.branch}: ahead ${item.ahead}, behind ${item.behind} versus ${item.comparison ?? "(none)"}`);
    }
    printHumanLine(`Orphaned commit clues: ${result.orphanedCommits.length}`);
    for (const item of result.orphanedCommits) printHumanLine(`  ${item.sha} ${item.subject}`);
    printHumanLine(`HEAD reachable from: ${result.headReachableFrom.join(", ") || "(none)"}`);
  }
}

function helpText() {
  return `Parallel Codex worktree safety toolkit

Usage:
  node tools/dev-parallel/worktree-manager.mjs doctor [--json]
  node tools/dev-parallel/worktree-manager.mjs new <workstream-name> [--json]
  node tools/dev-parallel/worktree-manager.mjs new-prompt
  node tools/dev-parallel/worktree-manager.mjs list [--json]
  node tools/dev-parallel/worktree-manager.mjs status [--json]
  node tools/dev-parallel/worktree-manager.mjs lineage [--json]
  node tools/dev-parallel/worktree-manager.mjs prepare-qa [expected-branch] [--json]
  node tools/dev-parallel/worktree-manager.mjs cleanup-check [worktree-path] [--disposable] [--json]

Safety:
  Commands use Git argument arrays and never switch the caller's branch.
  cleanup-check only evaluates; it never removes a worktree or branch.
  new fetches origin and creates feature/<safe-name> beside the main repository.
  Unsafe names, existing branches, existing paths and nested worktrees are refused.`;
}

function parseCli(argv) {
  const command = argv[0];
  const json = argv.includes("--json");
  const disposable = argv.includes("--disposable");
  const allowedFlags = new Set(["--json", "--help"]);
  if (command === "cleanup-check") allowedFlags.add("--disposable");
  const knownFlags = argv.filter((item) => item.startsWith("--") && !allowedFlags.has(item));
  if (knownFlags.length > 0) throw new CliError(`Unknown option: ${knownFlags[0]}`);
  const positional = argv.filter((item) => !allowedFlags.has(item));
  const [, ...args] = positional;
  return { command, args, json, disposable };
}

function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    console.log(helpText());
    return 0;
  }
  const parsed = parseCli(argv);
  let result;
  if (parsed.command === "doctor") result = doctor(cwd);
  else if (parsed.command === "new") {
    if (parsed.args.length !== 1) throw new CliError("Usage: new <workstream-name>");
    result = newWorktree(parsed.args[0], cwd);
  } else if (parsed.command === "list" || parsed.command === "status") {
    if (parsed.args.length !== 0) throw new CliError(`Usage: ${parsed.command}`);
    result = listWorktrees(cwd);
    result.command = parsed.command;
  } else if (parsed.command === "lineage") {
    if (parsed.args.length !== 0) throw new CliError("Usage: lineage");
    result = lineage(cwd);
  } else if (parsed.command === "prepare-qa") {
    if (parsed.args.length > 1) throw new CliError("Usage: prepare-qa [expected-branch]");
    result = prepareQa(parsed.args[0], cwd);
  } else if (parsed.command === "cleanup-check") {
    if (parsed.args.length > 1) throw new CliError("Usage: cleanup-check [worktree-path] [--disposable]");
    result = cleanupCheck(parsed.args[0], parsed.disposable, cwd);
  } else {
    throw new CliError(`Unknown command: ${parsed.command ?? "(none)"}. Use --help.`);
  }

  if (parsed.json) console.log(JSON.stringify(result, null, 2));
  else printResult(result);
  return result.exitCode;
}

async function promptForNewWorktree(cwd = process.cwd()) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = await prompt.question("Workstream name: ");
    const result = newWorktree(name, cwd);
    printResult(result);
    return result.exitCode;
  } finally {
    prompt.close();
  }
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  try {
    const directArgs = process.argv.slice(2);
    process.exitCode = directArgs[0] === "new-prompt" && directArgs.length === 1
      ? await promptForNewWorktree()
      : runCli(directArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("BLOCKED");
    console.error(`- ${terminalSafe(message)}`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  }
}

export {
  CliError,
  cleanupCheck,
  defaultWorktreeParent,
  doctor,
  lineage,
  listWorktrees,
  newWorktree,
  parseWorktreePorcelain,
  prepareQa,
  promptForNewWorktree,
  runCli,
  validateBranchName,
  validateWorkstreamName,
  trustedGitExecutable,
};
