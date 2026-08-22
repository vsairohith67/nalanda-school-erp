import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { trustedGitExecutable, validateWorkstreamName } from "./worktree-manager.mjs";

const SCRIPT = fileURLToPath(new URL("./worktree-manager.mjs", import.meta.url));
const WRAPPER = fileURLToPath(new URL("./worktree-doctor.cmd", import.meta.url));
const NEW_WRAPPER = fileURLToPath(new URL("./worktree-new.cmd", import.meta.url));

function run(command, args, cwd, allowFailure = false, input) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input,
    windowsHide: true,
    shell: false,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function git(cwd, ...args) {
  return run("git", args, cwd);
}

function manager(cwd, ...args) {
  return run(process.execPath, [SCRIPT, ...args], cwd, true);
}

function jsonResult(result) {
  assert.ok(result.stdout.trim(), `Expected JSON output. stderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

function createFixture(t, label) {
  const root = mkdtempSync(path.join(tmpdir(), `dev-parallel-${label}-`));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "origin remote.git");
  const repo = path.join(root, "repository with spaces");
  mkdirSync(repo, { recursive: true });
  git(root, "init", "--bare", remote);
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Disposable Test");
  git(repo, "config", "user.email", "disposable@example.invalid");
  writeFileSync(path.join(repo, "README.md"), "initial\n", "utf8");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "initial");
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "-u", "origin", "main");
  return { root, remote, repo };
}

function createCommit(repo, name, content = name) {
  const file = path.join(repo, name);
  writeFileSync(file, `${content}\n`, "utf8");
  git(repo, "add", name);
  git(repo, "commit", "-m", `add ${name}`);
}

test("1. clean repository doctor reports SAFE", (t) => {
  const { repo } = createFixture(t, "clean");
  const result = manager(repo, "doctor", "--json");
  assert.equal(result.status, 0);
  const body = jsonResult(result);
  assert.equal(body.status, "SAFE");
  assert.equal(body.clean, true);
});

test("2. dirty main worktree produces a warning without changing the file", (t) => {
  const { repo } = createFixture(t, "dirty-main");
  writeFileSync(path.join(repo, "README.md"), "unfinished main work\n", "utf8");
  const result = manager(repo, "doctor", "--json");
  assert.equal(result.status, 0);
  assert.equal(jsonResult(result).status, "WARNING");
  assert.equal(readFileSync(path.join(repo, "README.md"), "utf8"), "unfinished main work\n");
});

test("3. a second worktree can be created while the primary is dirty", (t) => {
  const { repo } = createFixture(t, "dirty-create");
  writeFileSync(path.join(repo, "README.md"), "primary dirty sentinel\n", "utf8");
  const result = manager(repo, "new", "parallel one", "--json");
  assert.equal(result.status, 0, result.stderr);
  const body = jsonResult(result);
  assert.equal(body.branch, "feature/parallel-one");
  assert.match(body.path, /parallel-one$/);
});

test("4. creating a worktree leaves the dirty primary content and branch untouched", (t) => {
  const { repo } = createFixture(t, "untouched");
  writeFileSync(path.join(repo, "README.md"), "do not touch\n", "utf8");
  const beforeBranch = git(repo, "branch", "--show-current").stdout.trim();
  const result = manager(repo, "new", "isolated", "--json");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(repo, "README.md"), "utf8"), "do not touch\n");
  assert.equal(git(repo, "branch", "--show-current").stdout.trim(), beforeBranch);
  assert.match(git(repo, "status", "--short").stdout, /M README\.md/);
});

test("5. an existing local branch is refused", (t) => {
  const { repo } = createFixture(t, "branch-exists");
  git(repo, "branch", "feature/existing");
  const result = manager(repo, "new", "existing");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /already exists/i);
});

test("6. a branch already checked out in another worktree is refused with its path", (t) => {
  const { root, repo } = createFixture(t, "branch-checked");
  const other = path.join(root, "already checked out");
  git(repo, "worktree", "add", "-b", "feature/checked", other, "HEAD");
  const result = manager(repo, "new", "checked");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /already checked out/i);
  assert.match(result.stderr, /already checked out/);
});

test("7. repository and worktree paths containing spaces are handled", (t) => {
  const { repo } = createFixture(t, "spaces");
  assert.match(repo, / /);
  const created = jsonResult(manager(repo, "new", "path spaces", "--json"));
  const listed = jsonResult(manager(created.path, "list", "--json"));
  assert.ok(listed.worktrees.some((item) => item.path === created.path.replaceAll("\\", "/") || path.resolve(item.path) === path.resolve(created.path)));
});

test("8. invalid branch and shell characters are rejected", () => {
  for (const value of ["a&b", "a&&b", "a|b", "a;b", "a$b", "a`b", "a\"b", "a'b", "a/b", "a\\b"]) {
    assert.throws(() => validateWorkstreamName(value), /refused|allowed|valid|ASCII|path/i, value);
  }
});

test("9. traversal attempts are rejected", () => {
  for (const value of ["..", "../escape", "safe..escape", ".\\..\\escape"]) {
    assert.throws(() => validateWorkstreamName(value), /traversal|allowed|valid|path/i, value);
  }
});

test("10. detached HEAD is BLOCKED by doctor", (t) => {
  const { repo } = createFixture(t, "detached");
  git(repo, "checkout", "--detach", "HEAD");
  const result = manager(repo, "doctor", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.equal(body.detached, true);
});

test("11. a local-only commit is reported", (t) => {
  const { repo } = createFixture(t, "local-commit");
  createCommit(repo, "local.txt");
  const body = jsonResult(manager(repo, "doctor", "--json"));
  assert.equal(body.status, "WARNING");
  assert.equal(body.ahead, 1);
  assert.ok(body.reasons.some((reason) => /local-only commit/i.test(reason)));
});

test("12. recent checkout activity appears in the lineage audit", (t) => {
  const { repo } = createFixture(t, "checkout");
  git(repo, "switch", "-c", "feature/checkout-test");
  const body = jsonResult(manager(repo, "lineage", "--json"));
  assert.ok(body.checkoutEvents.length >= 1);
  assert.match(body.checkoutEvents[0].subject, /^checkout:/);
});

test("13. an accidental-looking commit before checkout is classified conservatively", (t) => {
  const { repo } = createFixture(t, "mixed-risk");
  createCommit(repo, "before-checkout.txt");
  git(repo, "switch", "-c", "feature/after-commit");
  const body = jsonResult(manager(repo, "lineage", "--json"));
  assert.equal(body.status, "MIXED_WORKSTREAM_RISK");
  assert.match(body.reasons.join(" "), /clue|inspect|not a claim|conservative/i);
});

test("14. untracked files are counted by doctor", (t) => {
  const { repo } = createFixture(t, "untracked");
  writeFileSync(path.join(repo, "untracked.txt"), "untracked\n", "utf8");
  const body = jsonResult(manager(repo, "doctor", "--json"));
  assert.equal(body.status, "WARNING");
  assert.equal(body.untracked, 1);
});

test("15. an ahead feature branch can pass prepare-qa when clean", (t) => {
  const { repo } = createFixture(t, "ahead");
  git(repo, "switch", "-c", "feature/ahead");
  createCommit(repo, "feature.txt");
  const result = manager(repo, "prepare-qa", "feature/ahead", "--json");
  assert.equal(result.status, 0, result.stderr);
  const body = jsonResult(result);
  assert.equal(body.status, "SAFE");
  assert.equal(body.branchAhead, 1);
});

test("16. a branch behind its upstream is reported", (t) => {
  const { root, remote, repo } = createFixture(t, "behind");
  const peer = path.join(root, "peer clone");
  git(root, "clone", remote, peer);
  git(peer, "config", "user.name", "Disposable Peer");
  git(peer, "config", "user.email", "peer@example.invalid");
  git(peer, "switch", "main");
  createCommit(peer, "remote.txt");
  git(peer, "push", "origin", "main");
  git(repo, "fetch", "origin");
  const body = jsonResult(manager(repo, "doctor", "--json"));
  assert.equal(body.status, "WARNING");
  assert.equal(body.behind, 1);
});

test("17. stale worktree metadata is detected without pruning it", (t) => {
  const { root, repo } = createFixture(t, "stale");
  const stale = path.join(root, "stale worktree");
  git(repo, "worktree", "add", "-b", "feature/stale", stale, "HEAD");
  rmSync(stale, { recursive: true, force: true });
  const body = jsonResult(manager(repo, "doctor", "--json"));
  assert.equal(body.status, "WARNING");
  assert.ok(body.reasons.some((reason) => /stale worktree metadata/i.test(reason)));
  assert.match(git(repo, "worktree", "list", "--porcelain").stdout, /feature\/stale/);
});

test("18. cleanup-check reports SAFE_TO_REMOVE for a clean, pushed, merged worktree", (t) => {
  const { repo } = createFixture(t, "cleanup-safe");
  const created = jsonResult(manager(repo, "new", "cleanup safe", "--json"));
  git(created.path, "config", "user.name", "Disposable Test");
  git(created.path, "config", "user.email", "disposable@example.invalid");
  createCommit(created.path, "cleanup.txt");
  git(created.path, "push", "-u", "origin", created.branch);
  git(repo, "merge", "--no-ff", created.branch, "-m", "merge cleanup branch");
  git(repo, "push", "origin", "main");
  const result = manager(repo, "cleanup-check", created.path, "--json");
  assert.equal(result.status, 0, result.stderr);
  const body = jsonResult(result);
  assert.equal(body.status, "SAFE_TO_REMOVE");
  assert.equal(body.pushed, true);
  assert.equal(body.merged, true);
});

test("19. cleanup-check reports NOT_SAFE_TO_REMOVE for dirty, unpushed work", (t) => {
  const { repo } = createFixture(t, "cleanup-unsafe");
  const created = jsonResult(manager(repo, "new", "cleanup unsafe", "--json"));
  writeFileSync(path.join(created.path, "untracked.txt"), "keep me\n", "utf8");
  const result = manager(repo, "cleanup-check", created.path, "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "NOT_SAFE_TO_REMOVE");
  assert.equal(body.clean, false);
  assert.equal(body.pushed, false);
});

test("20. multiple simultaneous worktrees are listed with physical paths and branches", (t) => {
  const { repo } = createFixture(t, "multiple");
  const first = jsonResult(manager(repo, "new", "alpha stream", "--json"));
  const second = jsonResult(manager(repo, "new", "beta stream", "--json"));
  const body = jsonResult(manager(repo, "list", "--json"));
  assert.ok(body.worktrees.length >= 3);
  assert.ok(body.worktrees.some((item) => item.branch === first.branch));
  assert.ok(body.worktrees.some((item) => item.branch === second.branch));
  assert.ok(body.worktrees.every((item) => item.path));
});

test("21. spaces sanitize predictably while Unicode, leading dashes and absolute paths are refused", () => {
  assert.equal(validateWorkstreamName("My Safe Work 1A"), "my-safe-work-1a");
  for (const value of ["--help", "-feature", "café", "Ｆｅａｔｕｒｅ", "C:\\escape", "/absolute"]) {
    assert.throws(() => validateWorkstreamName(value), /ASCII|absolute|dash|refused|valid/i, value);
  }
});

test("22. unknown options and help-like workstream names cannot become Git arguments", (t) => {
  const { repo } = createFixture(t, "options");
  const unknown = manager(repo, "doctor", "--branch=evil");
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown option/);
  const leading = manager(repo, "new", "--evil");
  assert.equal(leading.status, 2);
  assert.match(leading.stderr, /Unknown option|dash/);
});

test("23. prepare-qa blocks a dirty branch and names the remaining path", (t) => {
  const { repo } = createFixture(t, "prepare-dirty");
  git(repo, "switch", "-c", "feature/dirty-qa");
  createCommit(repo, "implemented.txt");
  writeFileSync(path.join(repo, "remaining.txt"), "unfinished\n", "utf8");
  const result = manager(repo, "prepare-qa", "feature/dirty-qa", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.match(body.reasons.join(" "), /remaining\.txt/);
});

test("24. cleanup-check refuses the current worktree", (t) => {
  const { repo } = createFixture(t, "cleanup-current");
  const result = manager(repo, "cleanup-check", repo, "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "NOT_SAFE_TO_REMOVE");
  assert.match(body.reasons.join(" "), /current worktree/i);
});

test("25. help and Windows wrapper execution are useful", (t) => {
  const { repo } = createFixture(t, "help");
  const help = manager(repo, "--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.match(help.stdout, /cleanup-check/);
  if (process.platform === "win32") {
    const wrapper = run("cmd.exe", ["/d", "/c", WRAPPER], repo, true);
    assert.equal(wrapper.status, 0, wrapper.stderr);
    assert.match(wrapper.stdout, /SAFE/);
  }
});

test("26. manager execution code contains no shell mode or destructive Git command", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(source, /shell:\s*true/);
  assert.doesNotMatch(source, /exec\s*\(/);
  assert.doesNotMatch(source, /reset\W+--hard/);
  assert.doesNotMatch(source, /clean\W+-fd/);
  assert.doesNotMatch(source, /branch\W+-D/);
  assert.doesNotMatch(source, /worktree\W+remove/);
  assert.doesNotMatch(source, /push\W+--force/);
  assert.doesNotMatch(source, /stash\W+drop/);
  assert.doesNotMatch(source, /reflog\W+expire/);
});

test("27. doctor fails closed when Git status cannot be inspected", (t) => {
  const { repo } = createFixture(t, "status-failure");
  writeFileSync(path.join(repo, "dirty.txt"), "dirty\n", "utf8");
  git(repo, "config", "status.showUntrackedFiles", "bogus");
  const result = manager(repo, "doctor", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.equal(body.clean, false);
  assert.match(body.reasons.join(" "), /status could not be read/i);
});

test("28. lineage finds local commits on a branch without an upstream", (t) => {
  const { repo } = createFixture(t, "no-upstream");
  git(repo, "switch", "-c", "feature/no-upstream");
  createCommit(repo, "local-only.txt");
  const body = jsonResult(manager(repo, "lineage", "--json"));
  assert.ok(["REVIEW_LOCAL_COMMIT", "MIXED_WORKSTREAM_RISK"].includes(body.status));
  assert.ok(body.localOnlyCommits.length >= 1);
  assert.ok(body.localOnlyBranches.some((item) => item.branch === "feature/no-upstream" && item.comparison === "origin/main"));
});

test("29. Unicode filenames are matched across committed and dirty worktrees", (t) => {
  const { root, repo } = createFixture(t, "unicode-overlap");
  git(repo, "switch", "-c", "feature/unicode-current");
  createCommit(repo, "café.txt", "current feature");
  const other = path.join(root, "unicode other");
  git(repo, "worktree", "add", "-b", "feature/unicode-other", other, "origin/main");
  writeFileSync(path.join(other, "café.txt"), "other dirty work\n", "utf8");
  const result = manager(repo, "prepare-qa", "feature/unicode-current", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.ok(body.crossWorktreeOverlap.some((item) => item.includes("café.txt")));
});

test("30. an existing remote-only feature branch is refused", (t) => {
  const { repo } = createFixture(t, "remote-branch");
  git(repo, "branch", "feature/remote-only");
  git(repo, "push", "origin", "feature/remote-only");
  git(repo, "branch", "-d", "feature/remote-only");
  const result = manager(repo, "new", "remote only");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Remote branch origin\/feature\/remote-only already exists/i);
});

test("31. cleanup-check refreshes origin and refuses a remotely deleted branch", (t) => {
  const { root, remote, repo } = createFixture(t, "cleanup-refresh");
  const created = jsonResult(manager(repo, "new", "cleanup refresh", "--json"));
  git(created.path, "config", "user.name", "Disposable Test");
  git(created.path, "config", "user.email", "disposable@example.invalid");
  createCommit(created.path, "cleanup-refresh.txt");
  git(created.path, "push", "-u", "origin", created.branch);
  git(repo, "merge", "--no-ff", created.branch, "-m", "merge cleanup refresh");
  git(repo, "push", "origin", "main");
  assert.equal(manager(repo, "cleanup-check", created.path, "--json").status, 0);
  const peer = path.join(root, "cleanup peer");
  git(root, "clone", remote, peer);
  git(peer, "push", "origin", "--delete", created.branch);
  const result = manager(repo, "cleanup-check", created.path, "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.originFetched, true);
  assert.equal(body.pushed, false);
});

test("32. existing worktree parent symlinks or junctions are refused", (t) => {
  const { root, repo } = createFixture(t, "parent-link");
  const parent = path.join(root, "repository-with-spaces-worktrees");
  const redirect = path.join(root, "redirect target");
  mkdirSync(redirect, { recursive: true });
  try {
    symlinkSync(redirect, parent, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    t.skip(`Symlink/junction creation is unavailable: ${error.message}`);
    return;
  }
  const result = manager(repo, "new", "linked parent");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /symbolic link/i);
});

test("33. Git is pinned outside the inspected current directory", (t) => {
  const { repo } = createFixture(t, "trusted-git");
  const trusted = trustedGitExecutable();
  assert.equal(path.isAbsolute(trusted), true);
  if (process.platform === "win32") {
    copyFileSync(path.join(process.env.SystemRoot, "System32", "cmd.exe"), path.join(repo, "git.exe"));
    const result = manager(repo, "doctor", "--json");
    assert.equal(result.status, 0, result.stderr);
    const body = jsonResult(result);
    assert.equal(body.status, "WARNING");
    assert.equal(body.untracked, 1);
  }
});

test("34. Windows wrapper payload is rejected without command execution", (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows CMD wrapper test");
    return;
  }
  const { repo } = createFixture(t, "wrapper-injection");
  const marker = path.join(repo, "WRAPPER_INJECTED.txt");
  const payload = `safe"&echo WRAPPER_INJECTED&rem "`;
  const result = run("cmd.exe", ["/d", "/c", NEW_WRAPPER], repo, true, `${payload}\r\n`);
  assert.equal(result.status, 2, `Wrapper did not preserve the manager exit code. stdout=${result.stdout} stderr=${result.stderr}`);
  assert.doesNotMatch(result.stdout, /WRAPPER_INJECTED/, `Wrapper command injection executed. stderr=${result.stderr}`);
  assert.equal(existsSync(marker), false, `Wrapper injection marker was created. stdout=${result.stdout} stderr=${result.stderr}`);
  for (const wrapperPath of [NEW_WRAPPER, WRAPPER, fileURLToPath(new URL("./worktree-list.cmd", import.meta.url)), fileURLToPath(new URL("./lineage-audit.cmd", import.meta.url))]) {
    const source = readFileSync(wrapperPath, "utf8");
    assert.doesNotMatch(source, /%\*|%~[1-9]/, wrapperPath);
  }
});

test("35. an ambiguous existing target directory is never reused", (t) => {
  const { root, repo } = createFixture(t, "existing-target");
  const target = path.join(root, "repository-with-spaces-worktrees", "ambiguous");
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, "sentinel.txt"), "preserve\n", "utf8");
  const result = manager(repo, "new", "ambiguous");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /already exists/i);
  assert.equal(readFileSync(path.join(target, "sentinel.txt"), "utf8"), "preserve\n");
});

test("36. Windows-reserved device names are rejected before Git runs", () => {
  for (const value of ["CON", "nul", "Aux", "PRN", "COM1", "com9", "LPT1", "lpt9"]) {
    assert.throws(() => validateWorkstreamName(value), /Windows-reserved device/i, value);
  }
});

test("37. cleanup-only options are rejected by unrelated commands", (t) => {
  const { repo } = createFixture(t, "option-scope");
  const result = manager(repo, "doctor", "--disposable");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option: --disposable/);
});

test("38. doctor finds local-only commits without an upstream", (t) => {
  const { repo } = createFixture(t, "doctor-no-upstream");
  git(repo, "switch", "-c", "feature/doctor-no-upstream");
  createCommit(repo, "doctor-local.txt");
  const body = jsonResult(manager(repo, "doctor", "--json"));
  assert.equal(body.status, "WARNING");
  assert.equal(body.upstream, null);
  assert.equal(body.comparison, "origin/main");
  assert.equal(body.ahead, 1);
  assert.ok(body.reasons.some((reason) => /local-only commit.*origin\/main/i.test(reason)));
});

test("39. prepare-qa blocks a branch with unrelated history", (t) => {
  const { repo } = createFixture(t, "unrelated-history");
  git(repo, "switch", "--orphan", "feature/unrelated");
  writeFileSync(path.join(repo, "unrelated.txt"), "unrelated history\n", "utf8");
  git(repo, "add", "unrelated.txt");
  git(repo, "commit", "-m", "unrelated root");
  const result = manager(repo, "prepare-qa", "feature/unrelated", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.equal(body.mergeBase, null);
  assert.ok(body.blockers.some((reason) => /merge base|ahead\/behind|committed paths/i.test(reason)));
});

test("40. prepare-qa blocks when another worktree status is unreadable", (t) => {
  const { root, repo } = createFixture(t, "unreadable-peer");
  git(repo, "switch", "-c", "feature/current-qa");
  createCommit(repo, "current-qa.txt");
  const other = path.join(root, "unreadable peer");
  git(repo, "worktree", "add", "-b", "feature/unreadable-peer", other, "origin/main");
  git(repo, "config", "extensions.worktreeConfig", "true");
  git(other, "config", "--worktree", "status.showUntrackedFiles", "bogus");
  const result = manager(repo, "prepare-qa", "feature/current-qa", "--json");
  assert.equal(result.status, 2);
  const body = jsonResult(result);
  assert.equal(body.status, "BLOCKED");
  assert.ok(body.unreadableWorktrees.some((item) => path.resolve(item) === path.resolve(other)));
  assert.match(body.blockers.join(" "), /overlap is unverified/i);
});

test("41. lineage is UNKNOWN without an upstream or origin main", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "dev-parallel-lineage-unknown-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, "repository");
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Disposable Test");
  git(repo, "config", "user.email", "disposable@example.invalid");
  writeFileSync(path.join(repo, "README.md"), "isolated\n", "utf8");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "isolated root");
  const body = jsonResult(manager(repo, "lineage", "--json"));
  assert.equal(body.status, "UNKNOWN");
  assert.ok(body.reasons.some((reason) => /Neither an upstream nor origin\/main/i.test(reason)));
});

test("42. human-readable lineage prints checkout and local commit evidence", (t) => {
  const { repo } = createFixture(t, "lineage-output");
  git(repo, "switch", "-c", "feature/lineage-output");
  createCommit(repo, "lineage-output.txt");
  const sha = git(repo, "rev-parse", "HEAD").stdout.trim();
  const result = manager(repo, "lineage");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checkout:/);
  assert.match(result.stdout, new RegExp(sha));
  assert.match(result.stdout, /Merge base:/);
  assert.match(result.stdout, /HEAD reachable from:/);
});

test("43. new-prompt does not bypass option validation or help", (t) => {
  const { repo } = createFixture(t, "new-prompt-options");
  const invalid = manager(repo, "new-prompt", "--disposable");
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown option: --disposable/);
  const help = manager(repo, "new-prompt", "--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
  assert.doesNotMatch(help.stdout, /Workstream name:/);
});

test("44. human-readable doctor names its origin main fallback", (t) => {
  const { repo } = createFixture(t, "doctor-label");
  git(repo, "switch", "-c", "feature/doctor-label");
  createCommit(repo, "doctor-label.txt");
  const result = manager(repo, "doctor");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Upstream: \(none\)/);
  assert.match(result.stdout, /Ahead\/behind origin\/main: 1\/0/);
  assert.doesNotMatch(result.stdout, /Ahead\/behind upstream/);
});

test("45. lineage is UNKNOWN when any local branch lacks a comparison", (t) => {
  const { repo } = createFixture(t, "branch-comparison-missing");
  git(repo, "switch", "-c", "feature/audited");
  createCommit(repo, "audited.txt");
  git(repo, "push", "-u", "origin", "feature/audited");
  git(repo, "branch", "feature/no-comparison");
  git(repo, "update-ref", "-d", "refs/heads/main");
  git(repo, "update-ref", "-d", "refs/remotes/origin/main");
  const body = jsonResult(manager(repo, "lineage", "--json"));
  assert.equal(body.status, "UNKNOWN");
  assert.ok(body.reasons.some((reason) => /local branches have neither an upstream nor origin\/main/i.test(reason)));
});

test("46. human-readable lineage escapes terminal control characters", (t) => {
  const { repo } = createFixture(t, "lineage-controls");
  git(repo, "switch", "-c", "feature/control-output");
  writeFileSync(path.join(repo, "control.txt"), "control subject\n", "utf8");
  git(repo, "add", "control.txt");
  git(repo, "commit", "-m", `safe subject ${String.fromCharCode(27)}[2Jspoof`);
  const result = manager(repo, "lineage");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes(String.fromCharCode(27)), false);
  assert.match(result.stdout, /safe subject \\u001b\[2Jspoof/);
});
