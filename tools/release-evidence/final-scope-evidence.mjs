import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const artifactRoot = path.join(workspaceRoot, ".qa-artifacts", "final-scope-qa");
const contractPath = path.join(workspaceRoot, "tools", "release-evidence", "final-scope-contracts.json");
const contracts = JSON.parse(readFileSync(contractPath, "utf8"));

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function boundedArtifactPath(fileName) {
  const candidate = path.resolve(artifactRoot, fileName);
  if (!inside(artifactRoot, candidate)) throw new Error("FINAL_SCOPE_ARTIFACT_PATH_ESCAPE");
  if (existsSync(artifactRoot)) {
    if (lstatSync(artifactRoot).isSymbolicLink() || !inside(realpathSync(workspaceRoot), realpathSync(artifactRoot))) {
      throw new Error("FINAL_SCOPE_ARTIFACT_ROOT_UNSAFE");
    }
  }
  if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink()) throw new Error("FINAL_SCOPE_ARTIFACT_FILE_UNSAFE");
  return candidate;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 30_000,
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${options.reason ?? "COMMAND_FAILED"}: ${String(result.stderr || result.stdout).trim().slice(0, 600)}`);
  }
  return { status: result.status ?? 1, stdout: String(result.stdout ?? ""), stderr: String(result.stderr ?? "") };
}

function git(args, options = {}) {
  return command("git", args, options);
}

function gitText(args) {
  return git(args).stdout.trim();
}

function isAncestor(ancestor, descendant) {
  return git(["merge-base", "--is-ancestor", ancestor, descendant], { allowFailure: true }).status === 0;
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  const handle = openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(handle);
  }
  return hash.digest("hex").toUpperCase();
}

function walkFiles(root, maximum = 20_000) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (files.length >= maximum) throw new Error("FINAL_SCOPE_BOUNDED_WALK_LIMIT_EXCEEDED");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  if (existsSync(root)) visit(root);
  return files;
}

function routeInventoryFromFiles(files) {
  const entries = [];
  for (const file of files) {
    const relative = file.replace(/^app\//, "");
    if (!relative.endsWith("/page.tsx") && !relative.endsWith("/route.ts") && relative !== "page.tsx" && relative !== "route.ts") continue;
    const kind = relative.startsWith("api/") ? "api" : "page";
    const route = relative
      .replace(/\/page\.tsx$/, "")
      .replace(/\/route\.ts$/, "")
      .replace(/^page\.tsx$/, "")
      .replace(/^route\.ts$/, "")
      .split("/")
      .filter((segment) => !/^\(.+\)$/.test(segment))
      .join("/");
    entries.push({ kind, route: `/${route}`.replace(/\/$/, "") || "/", file: relative });
  }
  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.route.localeCompare(b.route));
  return {
    pageCount: entries.filter((entry) => entry.kind === "page").length,
    apiCount: entries.filter((entry) => entry.kind === "api").length,
    routes: entries
  };
}

function routeInventory() {
  const appRoot = path.join(workspaceRoot, "app");
  return routeInventoryFromFiles(walkFiles(appRoot, 8_000).map((file) => `app/${path.relative(appRoot, file).replaceAll(path.sep, "/")}`));
}

function extractStringArray(source, exportName) {
  const match = source.match(new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`));
  if (!match) throw new Error(`FINAL_SCOPE_${exportName}_NOT_FOUND`);
  return [...match[1].matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((item) => item[1]);
}

function migrationInventory() {
  const root = path.join(workspaceRoot, "prisma", "migrations");
  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort();
  const normalized = directories.map((entry) => entry.toLowerCase());
  return {
    count: directories.length,
    list: directories,
    duplicateNames: normalized.filter((entry, index) => normalized.indexOf(entry) !== index)
  };
}

function backupContract() {
  const backupSource = readFileSync(path.join(workspaceRoot, "lib", "backup.ts"), "utf8");
  const restoreSource = readFileSync(path.join(workspaceRoot, "lib", "restore.ts"), "utf8");
  const backupVersion = Number(backupSource.match(/backupVersion:\s*(\d+)/)?.[1] ?? 0);
  const maximumRestoreVersion = Number(restoreSource.match(/Number\(metadata\.backupVersion\)\s*>\s*(\d+)/)?.[1] ?? 0);
  return { backupVersion, maximumRestoreVersion, compatible: backupVersion > 0 && backupVersion === maximumRestoreVersion };
}

function packageInventory() {
  const packageJson = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
  const lock = readFileSync(path.join(workspaceRoot, "pnpm-lock.yaml"), "utf8");
  return {
    name: packageJson.name,
    version: packageJson.version,
    private: packageJson.private === true,
    lockfileVersion: lock.match(/^lockfileVersion:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim() ?? "UNKNOWN",
    dependencyCount: Object.keys(packageJson.dependencies ?? {}).length,
    devDependencyCount: Object.keys(packageJson.devDependencies ?? {}).length
  };
}

function gitFile(ref, file) {
  return git(["show", `${ref}:${file}`], { reason: "FINAL_SCOPE_REF_FILE_MISSING" }).stdout;
}

function gitTreeFiles(ref) {
  return git(["ls-tree", "-r", "--name-only", "-z", ref]).stdout
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
}

function refInventory(ref) {
  const files = gitTreeFiles(ref);
  const routes = routeInventoryFromFiles(files.filter((file) => file.startsWith("app/")));
  const migrationList = files
    .filter((file) => /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(file))
    .map((file) => file.split("/")[2])
    .sort();
  const normalizedMigrations = migrationList.map((entry) => entry.toLowerCase());
  const backupSource = gitFile(ref, "lib/backup.ts");
  const restoreSource = gitFile(ref, "lib/restore.ts");
  const packageJson = JSON.parse(gitFile(ref, "package.json"));
  const lock = gitFile(ref, "pnpm-lock.yaml");
  const permissionsSource = gitFile(ref, "lib/permissions.ts");
  return {
    ref,
    sha: gitText(["rev-parse", ref]),
    routeCount: routes.pageCount,
    apiCount: routes.apiCount,
    routes: routes.routes,
    migrationCount: migrationList.length,
    migrations: migrationList,
    duplicateMigrationNames: normalizedMigrations.filter((entry, index) => normalizedMigrations.indexOf(entry) !== index),
    backupVersion: Number(backupSource.match(/backupVersion:\s*(\d+)/)?.[1] ?? 0),
    restoreMaximumBackupVersion: Number(restoreSource.match(/Number\(metadata\.backupVersion\)\s*>\s*(\d+)/)?.[1] ?? 0),
    testFileCount: files.filter((file) => file.startsWith("tests/") && file.endsWith(".test.ts")).length,
    roles: extractStringArray(permissionsSource, "ROLES"),
    permissions: extractStringArray(permissionsSource, "PERMISSIONS"),
    featureFlags: JSON.parse(gitFile(ref, "config/release-feature-flags.json")),
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
      lockfileVersion: lock.match(/^lockfileVersion:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim() ?? "UNKNOWN",
      dependencyCount: Object.keys(packageJson.dependencies ?? {}).length,
      devDependencyCount: Object.keys(packageJson.devDependencies ?? {}).length
    }
  };
}

function featureFlagInventory() {
  const flags = JSON.parse(readFileSync(path.join(workspaceRoot, "config", "release-feature-flags.json"), "utf8"));
  const runtimeFiles = ["app", "components", "lib"].flatMap((directory) => walkFiles(path.join(workspaceRoot, directory), 20_000))
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && statSync(file).size <= 2 * 1024 * 1024);
  const runtimeSources = runtimeFiles.map((file) => ({ file, source: readFileSync(file, "utf8") }));
  const contractsByKey = new Map(contracts.featureFlagRuntimeContracts.map((entry) => [entry.key, entry]));
  const runtimeContracts = flags.map((flag) => {
    const contract = contractsByKey.get(flag.key) ?? null;
    const runtimeReferences = runtimeSources
      .filter((entry) => entry.source.includes(flag.key))
      .map((entry) => path.relative(workspaceRoot, entry.file).replaceAll(path.sep, "/"))
      .sort();
    const evidencePathsExist = Boolean(contract && contract.evidencePaths.every((file) => existsSync(path.join(workspaceRoot, file))));
    return {
      key: flag.key,
      status: contract?.status ?? "UNCLASSIFIED",
      runtimeReferences,
      evidencePaths: contract?.evidencePaths ?? [],
      evidencePathsExist
    };
  });
  const exampleLines = readFileSync(path.join(workspaceRoot, ".env.example"), "utf8").split(/\r?\n/);
  const safeConfigurationDefaults = [];
  for (const line of exampleLines) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']?([^"'\s#]+)["']?\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (/(?:ENABLED|INDEXING|PROVIDER|SMART_AI|AUTH2B_DELIVERY)/.test(key) && /^(?:false|disabled)$/i.test(value)) {
      safeConfigurationDefaults.push({ key, value });
    }
  }
  safeConfigurationDefaults.sort((a, b) => a.key.localeCompare(b.key));
  return { releaseFlags: flags, safeConfigurationDefaults, runtimeContracts };
}

function reachableAnnotatedTags(mainRef) {
  const rows = gitText(["for-each-ref", "refs/tags", "--format=%(refname:short)|%(objecttype)"])
    .split(/\r?\n/)
    .filter(Boolean);
  return rows
    .map((row) => row.split("|"))
    .filter(([, type]) => type === "tag")
    .map(([name]) => ({ name, commit: gitText(["rev-list", "-n", "1", name]) }))
    .filter((entry) => isAncestor(entry.commit, mainRef))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function clearedReleaseChecks(mainRef) {
  return contracts.clearedReleases.map((release) => {
    const tagType = git(["cat-file", "-t", `refs/tags/${release.tag}`], { allowFailure: true });
    const tagCommit = tagType.status === 0 ? gitText(["rev-list", "-n", "1", release.tag]) : null;
    const branchChecks = release.retainedBranches.map((branch) => {
      const exists = git(["show-ref", "--verify", `refs/remotes/${branch.ref}`], { allowFailure: true }).status === 0;
      const head = exists ? gitText(["rev-parse", branch.ref]) : null;
      const containedInRelease = Boolean(head && tagCommit && isAncestor(head, tagCommit));
      const policyPass = exists && (branch.policy !== "HEAD_CONTAINED_IN_RELEASE" || containedInRelease);
      return { ref: branch.ref, policy: branch.policy, exists, head, containedInRelease, status: policyPass ? "PASS" : "FAIL" };
    });
    const checks = {
      annotatedTag: tagType.stdout.trim() === "tag",
      intendedCommit: tagCommit === release.commit,
      containedInCurrentMain: Boolean(tagCommit && isAncestor(tagCommit, mainRef)),
      retainedBranches: branchChecks.every((entry) => entry.status === "PASS")
    };
    return {
      id: release.id,
      name: release.name,
      tag: release.tag,
      expectedCommit: release.commit,
      resolvedCommit: tagCommit,
      softwareStatus: release.softwareStatus ?? "CLEARED",
      activationStatus: release.activationStatus ?? "NOT_APPLICABLE",
      checks,
      retainedBranches: branchChecks,
      status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL"
    };
  });
}

function annotatedTagCheck(tag, mainRef) {
  const tagType = git(["cat-file", "-t", `refs/tags/${tag.name}`], { allowFailure: true });
  const resolvedCommit = tagType.status === 0 ? gitText(["rev-list", "-n", "1", tag.name]) : null;
  const checks = {
    annotatedTag: tagType.stdout.trim() === "tag",
    intendedCommit: resolvedCommit === tag.commit,
    containedInCurrentMain: Boolean(resolvedCommit && isAncestor(resolvedCommit, mainRef))
  };
  return { name: tag.name, expectedCommit: tag.commit, resolvedCommit, checks, status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL" };
}

function requirementReleaseChecks(mainRef) {
  const registerSource = readFileSync(path.join(workspaceRoot, "docs", "REQUIREMENTS_REGISTER.md"), "utf8");
  const clearedRows = registerSource.split(/\r?\n/).flatMap((line) => {
    if (!line.startsWith("| V")) return [];
    const columns = line.split("|").slice(1, -1).map((part) => part.trim());
    return columns[6] === "CLEARED" ? [{ id: columns[0], line }] : [];
  });
  const mappingIds = contracts.requirementReleases.map((entry) => entry.id);
  const mappings = new Map(contracts.requirementReleases.map((entry) => [entry.id, entry]));
  const mappedIds = [...mappings.keys()].sort();
  const clearedIds = clearedRows.map((row) => row.id).sort();
  const duplicateMappings = mappingIds.filter((id, index) => mappingIds.indexOf(id) !== index);
  const unmappedClearedIds = clearedIds.filter((id) => !mappings.has(id));
  const nonClearedMappedIds = mappedIds.filter((id) => !clearedIds.includes(id));
  const localTags = new Set(gitText(["tag", "--list"]).split(/\r?\n/).filter(Boolean));
  const releases = clearedRows.map((row) => {
    const mapping = mappings.get(row.id);
    if (!mapping) return { id: row.id, tags: [], claimedTags: [], status: "FAIL" };
    const tags = mapping.tags.map((tag) => annotatedTagCheck(tag, mainRef));
    const claimedTags = [...row.line.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((name) => localTags.has(name)).sort();
    const mappedTagNames = new Set(mapping.tags.map((tag) => tag.name));
    const unverifiedClaimedTags = claimedTags.filter((tag) => !mappedTagNames.has(tag));
    return {
      id: row.id,
      tags,
      claimedTags,
      unverifiedClaimedTags,
      status: tags.length > 0 && tags.every((tag) => tag.status === "PASS") && unverifiedClaimedTags.length === 0 ? "PASS" : "FAIL"
    };
  });
  const coverage = {
    clearedRequirementCount: clearedIds.length,
    mappedRequirementCount: mappedIds.length,
    clearedIds,
    mappedIds,
    duplicateMappings,
    unmappedClearedIds,
    nonClearedMappedIds,
    status: duplicateMappings.length === 0 && unmappedClearedIds.length === 0 && nonClearedMappedIds.length === 0 && releases.every((release) => release.status === "PASS") ? "PASS" : "FAIL"
  };
  return { coverage, releases };
}

function blockedBranchChecks(mainRef) {
  return contracts.releaseBlockedBranches.map((branch) => {
    const exists = git(["show-ref", "--verify", `refs/remotes/${branch.ref}`], { allowFailure: true }).status === 0;
    if (!exists) return { ...branch, exists: false, status: "EVIDENCE_MISSING" };
    const sha = gitText(["rev-parse", branch.ref]);
    const mergeBase = gitText(["merge-base", mainRef, branch.ref]);
    const [behindMain, aheadOfMain] = gitText(["rev-list", "--left-right", "--count", `${mainRef}...${branch.ref}`]).split(/\s+/).map(Number);
    const containedInCurrentMain = isAncestor(sha, mainRef);
    return { ...branch, exists: true, sha, mergeBase, behindMain, aheadOfMain, containedInCurrentMain, evidenceStatus: containedInCurrentMain ? "STALE_CLASSIFICATION" : "PASS" };
  });
}

function trackedSafetyInventory() {
  const tracked = git(["ls-files", "-z"]).stdout.split("\0").filter(Boolean).map((entry) => entry.replaceAll("\\", "/"));
  const forbidden = tracked.filter((file) =>
    /(?:^|\/)(?:node_modules|\.next|dist|build|out)(?:\/|$)/i.test(file) ||
    /\.(?:db|sqlite|sqlite3|gguf|ggml|safetensors|onnx|pt|pth)$/i.test(file) ||
    /(?:^|\/)backups?\/.*\.json$/i.test(file)
  );
  const largeFiles = tracked.flatMap((file) => {
    const absolute = path.join(workspaceRoot, file);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) return [];
    const bytes = statSync(absolute).size;
    return bytes > 5 * 1024 * 1024 ? [{ file, bytes }] : [];
  });
  const markerFiles = [];
  for (const file of tracked.filter((entry) => /^(?:app|components|config|docs|lib|scripts|tests|tools)\//.test(entry))) {
    const absolute = path.join(workspaceRoot, file);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile() || statSync(absolute).size > 2 * 1024 * 1024) continue;
    const source = readFileSync(absolute, "utf8");
    if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) markerFiles.push(file);
  }
  return { trackedFileCount: tracked.length, forbiddenTrackedArtifacts: forbidden, largeTrackedFiles: largeFiles, unresolvedMergeMarkerFiles: markerFiles };
}

function documentationLinkCheck() {
  const missingDocuments = contracts.authoritativeDocuments.filter((file) => !existsSync(path.join(workspaceRoot, file)));
  const brokenLinks = [];
  const documents = contracts.authoritativeDocuments.concat(existsSync(path.join(workspaceRoot, "docs", "FINAL_CORRECTED_SCOPE_ACCEPTANCE.md")) ? ["docs/FINAL_CORRECTED_SCOPE_ACCEPTANCE.md"] : []);
  for (const file of documents.filter((entry) => existsSync(path.join(workspaceRoot, entry)))) {
    const source = readFileSync(path.join(workspaceRoot, file), "utf8");
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
      if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
      target = target.split("#", 1)[0].split("?", 1)[0];
      try { target = decodeURIComponent(target); } catch { brokenLinks.push({ document: file, target: "INVALID_URI_ENCODING" }); continue; }
      const resolved = path.resolve(path.dirname(path.join(workspaceRoot, file)), target);
      if (!inside(workspaceRoot, resolved) || !existsSync(resolved)) brokenLinks.push({ document: file, target });
    }
  }
  return { missingDocuments, brokenLinks, aliases: contracts.documentAliases };
}

function optionalJson(filePath) {
  if (!existsSync(filePath)) return null;
  const metadata = lstatSync(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 1024 * 1024) throw new Error("FINAL_SCOPE_OPTIONAL_JSON_UNSAFE");
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function operationalDatabaseIntegrity() {
  const databasePath = process.env.FINAL_SCOPE_OPERATIONAL_DB_PATH?.trim();
  const expectedHash = process.env.FINAL_SCOPE_OPERATIONAL_DB_BASELINE_SHA256?.trim().toUpperCase();
  if (!databasePath || !expectedHash) return "NOT_EVALUATED";
  const resolved = path.resolve(databasePath);
  if (inside(workspaceRoot, resolved)) return "INVALID_TARGET";
  if (!existsSync(resolved) || !lstatSync(resolved).isFile()) return "MISSING";
  return sha256File(resolved) === expectedHash ? "MATCH" : "MISMATCH";
}

function validateGateResults(value, expectedHeadSha, expectedMainSha, expectedCandidateTestFiles) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("FINAL_SCOPE_GATE_RESULTS_INVALID");
  const allowedStatuses = new Set([
    "FINAL_SCOPE_QA_CLEARED",
    "FINAL_SCOPE_QA_LOCAL_ACCEPTANCE_COMPLETE_RELEASE_BLOCKED_EXTERNAL_CI",
    "FINAL_SCOPE_QA_REQUIRES_FIXES",
    "FINAL_SCOPE_QA_BLOCKED"
  ]);
  const requiredStrings = ["migrationStatus", "restoreStatus", "securityStatus", "dependencyStatus", "secretConfigStatus", "featureFlagStatus", "buildStatus", "gitSafetyStatus", "externalGateStatus"];
  if (value.schemaVersion !== 1 || !allowedStatuses.has(value.status)) throw new Error("FINAL_SCOPE_GATE_RESULTS_STATUS_INVALID");
  if (value.headSha !== expectedHeadSha || value.baseSha !== expectedMainSha) throw new Error("FINAL_SCOPE_GATE_RESULTS_STALE");
  for (const field of ["testFilesPassed", "testFilesSkipped", "testFilesTotal", "testsPassed", "intentionalSkips", "testsTotal"]) {
    if (!Number.isInteger(value[field]) || value[field] < 0) throw new Error(`FINAL_SCOPE_GATE_RESULTS_${field.toUpperCase()}_INVALID`);
  }
  if (value.testFilesPassed + value.testFilesSkipped !== value.testFilesTotal || value.testsPassed + value.intentionalSkips !== value.testsTotal) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_TEST_TOTALS_INCONSISTENT");
  }
  if (value.testFilesTotal !== expectedCandidateTestFiles) throw new Error("FINAL_SCOPE_GATE_RESULTS_TEST_FILE_COUNT_MISMATCH");
  for (const field of requiredStrings) if (typeof value[field] !== "string" || !value[field]) throw new Error(`FINAL_SCOPE_GATE_RESULTS_${field.toUpperCase()}_INVALID`);
  const localFields = ["migrationStatus", "restoreStatus", "securityStatus", "dependencyStatus", "secretConfigStatus", "featureFlagStatus", "buildStatus", "gitSafetyStatus"];
  for (const field of localFields) {
    if (!/^(?:PASS|FAIL_[A-Z0-9_]+|BLOCKED_[A-Z0-9_]+|NOT_RUN|NOT_EVALUATED)$/.test(value[field])) {
      throw new Error(`FINAL_SCOPE_GATE_RESULTS_${field.toUpperCase()}_SEMANTICS_INVALID`);
    }
  }
  if (!/^(?:PASS|NOT_ATTEMPTED(?:_[A-Z0-9_]+)?|EXTERNAL_GITHUB_ACTIONS_BILLING_BLOCK|BLOCKED_[A-Z0-9_]+)$/.test(value.externalGateStatus)) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_EXTERNALGATESTATUS_SEMANTICS_INVALID");
  }
  if (!Array.isArray(value.mandatoryGateFailures) || value.mandatoryGateFailures.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_FAILURES_INVALID");
  }
  if (value.mandatoryGateFailures.length > 0 && !["FINAL_SCOPE_QA_REQUIRES_FIXES", "FINAL_SCOPE_QA_BLOCKED"].includes(value.status)) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_FALSE_GREEN");
  }
  if (value.status === "FINAL_SCOPE_QA_REQUIRES_FIXES" && value.mandatoryGateFailures.length === 0) throw new Error("FINAL_SCOPE_GATE_RESULTS_FAILURES_MISSING");
  if (value.status === "FINAL_SCOPE_QA_CLEARED" && (localFields.some((field) => value[field] !== "PASS") || value.externalGateStatus !== "PASS")) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_CLEARED_WITH_RED_GATE");
  }
  if (value.status === "FINAL_SCOPE_QA_LOCAL_ACCEPTANCE_COMPLETE_RELEASE_BLOCKED_EXTERNAL_CI" && (localFields.some((field) => value[field] !== "PASS") || value.externalGateStatus !== "EXTERNAL_GITHUB_ACTIONS_BILLING_BLOCK")) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_EXTERNAL_BLOCK_WITH_RED_LOCAL_GATE");
  }
  if (["FINAL_SCOPE_QA_CLEARED", "FINAL_SCOPE_QA_LOCAL_ACCEPTANCE_COMPLETE_RELEASE_BLOCKED_EXTERNAL_CI"].includes(value.status)
    && (value.testFilesPassed === 0 || value.testsPassed === 0 || value.testFilesTotal === 0 || value.testsTotal === 0)) {
    throw new Error("FINAL_SCOPE_GATE_RESULTS_GREEN_WITH_ZERO_TESTS");
  }
  return value;
}

function validateFocusedTests(value, expectedHeadSha, expectedMainSha) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1 || value.status !== "PASS") {
    throw new Error("FINAL_SCOPE_FOCUSED_RESULTS_INVALID");
  }
  if (value.headSha !== expectedHeadSha || value.baseSha !== expectedMainSha) throw new Error("FINAL_SCOPE_FOCUSED_RESULTS_STALE");
  for (const field of ["testFilesPassed", "testsPassed", "intentionalSkips"]) {
    if (!Number.isInteger(value[field]) || value[field] < 0) throw new Error(`FINAL_SCOPE_FOCUSED_RESULTS_${field.toUpperCase()}_INVALID`);
  }
  if (value.operationalCopyIntegrity !== "MATCH" || !Array.isArray(value.coveredTestFiles) || value.coveredTestFiles.length !== value.testFilesPassed) {
    throw new Error("FINAL_SCOPE_FOCUSED_RESULTS_FALSE_GREEN");
  }
  return value;
}

function main() {
  const artifactParent = path.dirname(artifactRoot);
  if (existsSync(artifactParent) && (lstatSync(artifactParent).isSymbolicLink() || !inside(realpathSync(workspaceRoot), realpathSync(artifactParent)))) {
    throw new Error("FINAL_SCOPE_ARTIFACT_PARENT_UNSAFE");
  }
  mkdirSync(artifactRoot, { recursive: true });
  const mainRef = contracts.mainRef;
  const candidateRoutes = routeInventory();
  const permissionsSource = readFileSync(path.join(workspaceRoot, "lib", "permissions.ts"), "utf8");
  const candidateMigrations = migrationInventory();
  const candidateBackup = backupContract();
  const flags = featureFlagInventory();
  const programmeReleases = clearedReleaseChecks(mainRef);
  const requirementReleases = requirementReleaseChecks(mainRef);
  const blockedBranches = blockedBranchChecks(mainRef);
  const trackedSafety = trackedSafetyInventory();
  const docs = documentationLinkCheck();
  const candidateTestFiles = walkFiles(path.join(workspaceRoot, "tests"), 5_000)
    .map((file) => path.relative(workspaceRoot, file).replaceAll(path.sep, "/"))
    .filter((file) => file.endsWith(".test.ts"))
    .sort();
  const headSha = gitText(["rev-parse", "HEAD"]);
  const currentMain = refInventory(mainRef);
  const branch = gitText(["branch", "--show-current"]);
  const worktreeChanges = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout.split(/\r?\n/).filter(Boolean);
  const candidateContainsCurrentMain = isAncestor(currentMain.sha, headSha);
  const candidateSchemaMatchesMain = readFileSync(path.join(workspaceRoot, "prisma", "schema.prisma"), "utf8") === gitFile(mainRef, "prisma/schema.prisma");
  const candidateRoles = extractStringArray(permissionsSource, "ROLES");
  const candidatePermissions = extractStringArray(permissionsSource, "PERMISSIONS");
  const candidatePackageJson = JSON.parse(readFileSync(path.join(workspaceRoot, "package.json"), "utf8"));
  const currentMainPackageJson = JSON.parse(gitFile(mainRef, "package.json"));
  const candidateRuntimePackageMatchesMain = JSON.stringify({
    name: candidatePackageJson.name,
    version: candidatePackageJson.version,
    private: candidatePackageJson.private,
    dependencies: candidatePackageJson.dependencies,
    devDependencies: candidatePackageJson.devDependencies,
    overrides: candidatePackageJson.pnpm?.overrides
  }) === JSON.stringify({
    name: currentMainPackageJson.name,
    version: currentMainPackageJson.version,
    private: currentMainPackageJson.private,
    dependencies: currentMainPackageJson.dependencies,
    devDependencies: currentMainPackageJson.devDependencies,
    overrides: currentMainPackageJson.pnpm?.overrides
  });
  const candidateRouteContractMatchesMain = JSON.stringify(candidateRoutes.routes) === JSON.stringify(currentMain.routes);
  const candidateRolesMatchMain = JSON.stringify(candidateRoles) === JSON.stringify(currentMain.roles);
  const candidatePermissionsMatchMain = JSON.stringify(candidatePermissions) === JSON.stringify(currentMain.permissions);
  const candidateFeatureFlagsMatchMain = JSON.stringify(flags.releaseFlags) === JSON.stringify(currentMain.featureFlags);
  const candidateBackupContractMatchesMain = candidateBackup.backupVersion === currentMain.backupVersion && candidateBackup.maximumRestoreVersion === currentMain.restoreMaximumBackupVersion;
  const failures = [];
  if (programmeReleases.some((release) => release.status !== "PASS")) failures.push("PROGRAMME_RELEASE_EVIDENCE_MISMATCH");
  if (requirementReleases.coverage.status !== "PASS") failures.push("CLEARED_REQUIREMENT_RELEASE_EVIDENCE_MISMATCH");
  if (blockedBranches.some((entry) => !entry.exists)) failures.push("BLOCKED_BRANCH_EVIDENCE_MISSING");
  if (blockedBranches.some((entry) => entry.containedInCurrentMain)) failures.push("BLOCKED_BRANCH_CLASSIFICATION_STALE");
  if (!candidateBackup.compatible || currentMain.backupVersion !== currentMain.restoreMaximumBackupVersion) failures.push("BACKUP_RESTORE_VERSION_MISMATCH");
  if (candidateMigrations.duplicateNames.length || currentMain.duplicateMigrationNames.length) failures.push("DUPLICATE_MIGRATION_NAMES");
  if (flags.runtimeContracts.some((entry) => entry.status === "UNCLASSIFIED" || !entry.evidencePathsExist || (entry.status === "ENFORCED" && !entry.runtimeReferences.length))) failures.push("FEATURE_FLAG_CONTRACT_INVENTORY_INVALID");
  if (flags.runtimeContracts.some((entry) => ["UNENFORCED_EXPOSED_SURFACE", "BLOCKED_BY_EVIDENCE"].includes(entry.status))) failures.push("FEATURE_FLAG_RUNTIME_ENFORCEMENT_FAILURE");
  if (trackedSafety.forbiddenTrackedArtifacts.length || trackedSafety.unresolvedMergeMarkerFiles.length) failures.push("TRACKED_GIT_SAFETY_FAILURE");
  if (docs.missingDocuments.length || docs.brokenLinks.length) failures.push("AUTHORITATIVE_DOCUMENT_LINK_FAILURE");
  if (!candidateContainsCurrentMain) failures.push("CANDIDATE_BEHIND_CURRENT_MAIN");
  if (worktreeChanges.length) failures.push("CANDIDATE_WORKTREE_DIRTY");
  if (!candidateSchemaMatchesMain || candidateMigrations.list.join("\n") !== currentMain.migrations.join("\n")) failures.push("PRODUCT_SCHEMA_SCOPE_EXPANSION");
  if (!candidateRouteContractMatchesMain) failures.push("PRODUCT_ROUTE_SCOPE_EXPANSION");
  if (!candidateRolesMatchMain || !candidatePermissionsMatchMain) failures.push("PRODUCT_AUTHORITY_SCOPE_EXPANSION");
  if (!candidateFeatureFlagsMatchMain || !candidateBackupContractMatchesMain) failures.push("PRODUCT_CONFIG_OR_BACKUP_SCOPE_EXPANSION");
  if (!candidateRuntimePackageMatchesMain) failures.push("PRODUCT_DEPENDENCY_SCOPE_EXPANSION");
  const candidate = {
    headSha,
    branch,
    worktreeState: worktreeChanges.length ? "DIRTY" : "CLEAN",
    worktreeChangeCount: worktreeChanges.length,
    containsCurrentMain: candidateContainsCurrentMain,
    package: packageInventory(),
    routeCount: candidateRoutes.pageCount,
    apiCount: candidateRoutes.apiCount,
    routes: candidateRoutes.routes,
    migrationCount: candidateMigrations.count,
    migrations: candidateMigrations.list,
    backupVersion: candidateBackup.backupVersion,
    restoreMaximumBackupVersion: candidateBackup.maximumRestoreVersion,
    testFileCount: candidateTestFiles.length,
    testFiles: candidateTestFiles,
    roles: candidateRoles,
    permissions: candidatePermissions,
    featureFlags: flags.releaseFlags,
    featureFlagRuntimeContracts: flags.runtimeContracts,
    safeConfigurationDefaults: flags.safeConfigurationDefaults,
    schemaMatchesCurrentMain: candidateSchemaMatchesMain,
    routeContractMatchesCurrentMain: candidateRouteContractMatchesMain,
    rolesMatchCurrentMain: candidateRolesMatchMain,
    permissionsMatchCurrentMain: candidatePermissionsMatchMain,
    featureFlagsMatchCurrentMain: candidateFeatureFlagsMatchMain,
    backupContractMatchesCurrentMain: candidateBackupContractMatchesMain,
    runtimePackageContractMatchesCurrentMain: candidateRuntimePackageMatchesMain
  };
  const inventory = {
    schemaVersion: 1,
    evidenceCommitTime: gitText(["show", "-s", "--format=%cI", "HEAD"]),
    taskStartMainSha: contracts.taskStartMainSha,
    currentMain,
    candidate,
    reachableAnnotatedReleaseTags: reachableAnnotatedTags(mainRef),
    requirementReleaseChecks: requirementReleases,
    programmeReleaseChecks: programmeReleases,
    releaseBlockedBranches: blockedBranches,
    documentAliases: contracts.documentAliases,
    trackedSafety,
    documentation: docs,
    status: failures.length ? "FAIL" : "PASS",
    failures
  };

  const gateResultPath = boundedArtifactPath("gate-results.json");
  const gateResults = validateGateResults(optionalJson(gateResultPath), headSha, currentMain.sha, candidate.testFileCount);
  const focusedTests = validateFocusedTests(optionalJson(boundedArtifactPath("focused-tests.json")), headSha, currentMain.sha);
  const dbIntegrity = operationalDatabaseIntegrity();
  const inventoryFailures = [...failures];
  const externalOnlyStatus = gateResults?.status === "FINAL_SCOPE_QA_LOCAL_ACCEPTANCE_COMPLETE_RELEASE_BLOCKED_EXTERNAL_CI";
  const localGateFields = ["migrationStatus", "restoreStatus", "securityStatus", "dependencyStatus", "secretConfigStatus", "featureFlagStatus", "buildStatus", "gitSafetyStatus"];
  const incompleteGateFields = gateResults
    ? localGateFields
      .filter((field) => /^(?:NOT_RUN|NOT_EVALUATED|UNKNOWN|BLOCKED_)/i.test(gateResults[field]))
      .map((field) => `MANDATORY_GATE_INCOMPLETE_${field.toUpperCase()}`)
    : ["MANDATORY_GATE_RESULTS_NOT_RECORDED"];
  const failedGateFields = gateResults
    ? localGateFields
      .filter((field) => /^FAIL_/i.test(gateResults[field]))
      .map((field) => `MANDATORY_GATE_FAILED_${field.toUpperCase()}_${gateResults[field]}`)
    : [];
  const mandatoryGateFailures = [
    ...failures,
    ...(dbIntegrity === "MATCH" ? [] : [`OPERATIONAL_DB_INTEGRITY_${dbIntegrity}`]),
    ...incompleteGateFields,
    ...failedGateFields,
    ...(gateResults?.mandatoryGateFailures ?? [])
  ];
  const hasRealFailure = inventoryFailures.length > 0 || dbIntegrity !== "MATCH" || failedGateFields.length > 0 || (gateResults?.mandatoryGateFailures.length ?? 0) > 0;
  const derivedStatus = hasRealFailure
    ? "FINAL_SCOPE_QA_REQUIRES_FIXES"
    : incompleteGateFields.length > 0
      ? "FINAL_SCOPE_QA_BLOCKED"
      : externalOnlyStatus
        ? "FINAL_SCOPE_QA_LOCAL_ACCEPTANCE_COMPLETE_RELEASE_BLOCKED_EXTERNAL_CI"
        : gateResults?.status ?? "FINAL_SCOPE_QA_BLOCKED";
  const report = {
    schemaVersion: 1,
    generatedAt: inventory.evidenceCommitTime,
    headSha,
    baseSha: currentMain.sha,
    status: derivedStatus,
    inventoryStatus: inventory.status,
    mandatoryGateFailures: [...new Set(mandatoryGateFailures)].sort(),
    routeCount: currentMain.routeCount,
    apiCount: currentMain.apiCount,
    candidateTestFileCount: candidate.testFileCount,
    currentMainTestFileCount: currentMain.testFileCount,
    testFilesPassed: gateResults?.testFilesPassed ?? focusedTests?.testFilesPassed ?? null,
    testFilesSkipped: gateResults?.testFilesSkipped ?? null,
    testFilesTotal: gateResults?.testFilesTotal ?? null,
    testsPassed: gateResults?.testsPassed ?? focusedTests?.testsPassed ?? null,
    intentionalSkips: gateResults?.intentionalSkips ?? focusedTests?.intentionalSkips ?? null,
    testsTotal: gateResults?.testsTotal ?? null,
    backupVersion: currentMain.backupVersion,
    operationalDbIntegrity: dbIntegrity,
    migrationStatus: gateResults?.migrationStatus ?? "NOT_RUN",
    restoreStatus: gateResults?.restoreStatus ?? "NOT_RUN",
    securityStatus: gateResults?.securityStatus ?? "NOT_RUN",
    dependencyStatus: gateResults?.dependencyStatus ?? "NOT_RUN",
    secretConfigStatus: gateResults?.secretConfigStatus ?? "NOT_RUN",
    featureFlagStatus: gateResults?.featureFlagStatus ?? "NOT_RUN",
    buildStatus: gateResults?.buildStatus ?? "NOT_RUN",
    gitSafetyStatus: gateResults?.gitSafetyStatus ?? "NOT_RUN",
    featureFlags: candidate.featureFlags.map(({ key, defaultState, rolloutPercentage, environment }) => ({ key, defaultState, rolloutPercentage, environment })),
    requirementReleaseChecks: requirementReleases.releases.map(({ id, status }) => ({ id, status })),
    programmeReleaseChecks: programmeReleases.map(({ id, tag, resolvedCommit, softwareStatus, activationStatus, status }) => ({ id, tag, resolvedCommit, softwareStatus, activationStatus, status })),
    releaseBlockedBranches: blockedBranches.map(({ id, name, ref, sha, aheadOfMain, behindMain, mergeBase, containedInCurrentMain, implementationState, blockerClass, status, evidenceStatus }) => ({ id, name, ref, sha, aheadOfMain, behindMain, mergeBase, containedInCurrentMain, implementationState, blockerClass, status, evidenceStatus })),
    externalGateStatus: gateResults?.externalGateStatus ?? "NOT_ATTEMPTED",
    currentMainChanged: currentMain.sha !== contracts.taskStartMainSha,
    candidateContainsCurrentMain
  };

  writeFileSync(boundedArtifactPath("current-main-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  writeFileSync(boundedArtifactPath("report.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  process.stdout.write(`${JSON.stringify({ result: derivedStatus === "FINAL_SCOPE_QA_CLEARED" ? "FINAL_SCOPE_INVENTORY_PASSED" : "FINAL_SCOPE_INVENTORY_FAILED", headSha, baseSha: currentMain.sha, routeCount: currentMain.routeCount, apiCount: currentMain.apiCount, currentMainTestFileCount: currentMain.testFileCount, candidateTestFileCount: candidate.testFileCount, backupVersion: currentMain.backupVersion, operationalDbIntegrity: dbIntegrity, failures: [...new Set(mandatoryGateFailures)].sort() })}\n`);
  if (derivedStatus !== "FINAL_SCOPE_QA_CLEARED") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "FINAL_SCOPE_EVIDENCE_FAILED"}\n`);
  process.exitCode = 1;
}
