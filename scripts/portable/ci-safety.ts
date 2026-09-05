import { randomUUID } from "node:crypto";
import { mkdir, lstat, realpath, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertEphemeralCi, docker, validateComposeFiles } from "./operator-adapter";

async function main() {
  assertEphemeralCi();
  const workspace = await realpath(process.cwd());
  const project = `nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-stack`;
  if (!/^nalanda-ci-\d+-\d+-stack$/.test(project) || process.env.COMPOSE_PROJECT_NAME !== project) throw new Error("CI_PROJECT_INVALID");
  if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== process.env.EXPECTED_SHA) throw new Error("EXACT_HEAD_REQUIRED");
  const root = path.join(workspace, "tmp", "portable-staging", project);
  if (process.env.PORTABLE_CI_ROOT !== root || process.env.PORTABLE_SYNTHETIC_SECRET_ROOT !== path.join(root, "secrets")) throw new Error("CI_ROOT_INVALID");
  const receiptRoot = path.join(workspace, ".qa-artifacts", "portable-ci");
  const compose = path.join(workspace, "deploy", "portable", "compose.yml");
  const resources = async (): Promise<Record<string, string[]>> => Object.fromEntries(await Promise.all(["container", "network", "volume"].map(async kind => [kind, (await docker([kind, "ls", ...(kind === "container" ? ["--all"] : []), "-q", "--filter", `label=com.docker.compose.project=${project}`], workspace)).trim().split(/\s+/).filter(Boolean)])));
  const missingOnly = (e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return null; throw e; };
  const admissionPath = path.join(receiptRoot, `${project}.admission.json`);
  const action = process.argv[2];
  if (action === "prepare") {
    if (await lstat(root).catch(missingOnly) || Object.values(await resources()).some(v => v.length)) throw new Error("CI_TARGET_NOT_FRESH");
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (await realpath(root) !== root) throw new Error("CI_ROOT_SYMLINK_FORBIDDEN");
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(admissionPath, JSON.stringify({ project, sourceCommit: process.env.EXPECTED_SHA, state: "FRESH_TARGET_ADMITTED" }), { flag: "wx", mode: 0o600 });
    return;
  }
  if (action === "validate") {
    await validateComposeFiles(JSON.parse(await docker(["compose", "--project-name", project, "-f", compose, "config", "--format", "json"], workspace)), workspace, root);
    return;
  }
  if (action !== "cleanup") throw new Error("CI_ACTION_INVALID");
  const admissionStat = await lstat(admissionPath).catch(missingOnly);
  if (!admissionStat || !admissionStat.isFile() || admissionStat.isSymbolicLink() || admissionStat.size > 1024) {
    await mkdir(receiptRoot, { recursive: true });
    await writeFile(path.join(receiptRoot, `${project}.${randomUUID()}.cleanup.json`), JSON.stringify({ result: "NOT_ADMITTED", resourcesRemoved: false, sourceCommit: process.env.EXPECTED_SHA }), { flag: "wx" });
    throw new Error("CI_CLEANUP_NOT_ADMITTED");
  }
  const admission = JSON.parse(await readFile(admissionPath, "utf8"));
  if (admission.project !== project || admission.sourceCommit !== process.env.EXPECTED_SHA || admission.state !== "FRESH_TARGET_ADMITTED") throw new Error("CI_ADMISSION_PROVENANCE_INVALID");
  const failures: string[] = [];
  const inventory = async () => {
    try { return await resources(); }
    catch { failures.push("RESOURCE_INVENTORY_UNAVAILABLE"); return { container: null, network: null, volume: null }; }
  };
  const before = await inventory();
  try { await docker(["compose", "--project-name", project, "--profile", "maintenance", "--profile", "maintenance-plan", "-f", compose, "down", "--volumes", "--remove-orphans"], workspace); } catch { failures.push("COMPOSE_TEARDOWN_FAILED"); }
  for (const suffix of [project, `${project}-candidate`]) {
    const tag = `nalanda-portable-staging:${suffix}`;
    try { if ((await docker(["image", "ls", "-q", tag], workspace)).trim()) await docker(["image", "rm", tag], workspace); if ((await docker(["image", "ls", "-q", tag], workspace)).trim()) failures.push("IMAGE_REMAINS"); } catch { failures.push("IMAGE_CLEANUP_FAILED"); }
  }
  const after = await inventory();
  if (Object.values(after).some(v => v === null || v.length)) failures.push("CI_RESOURCES_REMAIN");
  try {
    const stat = await lstat(root).catch(missingOnly);
    if (stat) { if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(root) !== root) throw new Error("UNSAFE"); await rm(root, { recursive: true }); }
    if (await lstat(root).catch(missingOnly)) failures.push("CI_FILES_REMAIN");
  } catch { failures.push("CI_FILES_CLEANUP_FAILED"); }
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(path.join(receiptRoot, `${project}.${randomUUID()}.cleanup.json`), JSON.stringify({ schemaVersion: 1, classification: "INTEGRATION_TEST_ENVIRONMENT", sourceCommit: process.env.EXPECTED_SHA,
    ownerException: "EPHEMERAL_EXACT_HEAD_CI_ONLY", countsBefore: Object.fromEntries(Object.entries(before).map(([k,v]) => [k,v === null ? null : v.length])), countsAfter: Object.fromEntries(Object.entries(after).map(([k,v]) => [k,v === null ? null : v.length])),
    generatedSecretsCertificatesAndTemporaryFilesRemoved: !failures.includes("CI_FILES_CLEANUP_FAILED") && !failures.includes("CI_FILES_REMAIN"), tlsContainerTmpfsRemoved: after.container !== null && after.container.length === 0,
    failures, result: failures.length ? "CLEANUP_FAILED" : "CLEANUP_VERIFIED" }, null, 2));
  if (failures.length) throw new Error("CI_CLEANUP_FAILED");
}
main().catch(() => { console.error("PORTABLE_CI_BOUNDARY_FAILED"); process.exitCode = 1; });
