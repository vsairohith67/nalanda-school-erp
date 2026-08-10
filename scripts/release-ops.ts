import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildReleasePackage, deploymentSizeExplanation, verifyReleasePackage } from "../lib/release-package";
import { validateReleaseEnvironmentContract } from "../lib/deployment-environment";
import { releaseFeatureFlagSnapshotSha256, releaseFeatureFlags } from "../lib/release-feature-flags";
import { activeMigrationManifest, sha256Bytes, sha256File } from "../lib/release-manifest";
import { isMigrationClassification, isReleaseEnvironment, isReleasePhase, type ReleaseCandidateState, type ReleaseEnvironment, type ReleaseFailure, type ReleaseGate, type ReleasePhase } from "../lib/release-operations-types";
import { acquireReleaseLock, appendReleaseAudit, createReleaseCandidate, readReleaseCandidate, readReleaseLock, releaseDiskProbe, releaseLock, releaseStateRoot, updateReleasePhase, verifyReleaseAudit, writeReleaseCandidate } from "../lib/release-state";

type Arguments = Record<string, string | boolean>;
const workspaceRoot = path.resolve(process.cwd());

function parseArguments(values: string[]) {
  const result: Arguments = {};
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!value.startsWith("--")) throw new Error(`RELEASE_ARGUMENT_INVALID:${value}`);
    const [key, inline] = value.slice(2).split("=", 2);
    if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error("RELEASE_ARGUMENT_NAME_INVALID");
    if (inline !== undefined) result[key] = inline;
    else if (values[index + 1] && !values[index + 1].startsWith("--")) result[key] = values[++index];
    else result[key] = true;
  }
  return result;
}

function required(args: Arguments, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`RELEASE_ARGUMENT_REQUIRED:${key}`);
  return value.trim();
}

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: workspaceRoot, encoding: "utf8", windowsHide: true, timeout: 30_000 }).trim();
}

function environment(args: Arguments): ReleaseEnvironment {
  const configured = required(args, "environment").toUpperCase();
  if (!isReleaseEnvironment(configured)) throw new Error("RELEASE_ENVIRONMENT_INVALID");
  return configured;
}

function stateRoot(args: Arguments) {
  return releaseStateRoot(workspaceRoot, typeof args["state-root"] === "string" ? args["state-root"] : process.env.NALANDA_RELEASE_STATE_ROOT);
}

function assertLock(root: string, args: Arguments) {
  const lock = readReleaseLock(root);
  if (!lock || lock.owner !== required(args, "owner") || lock.session !== required(args, "session") || lock.releaseId !== required(args, "release-id")) throw new Error("RELEASE_LOCK_REQUIRED");
  if (new Date(lock.expiresAt).valueOf() <= Date.now()) throw new Error("RELEASE_LOCK_EXPIRED");
  return lock;
}

function productionMutationAllowed(args: Arguments, releaseEnvironment: ReleaseEnvironment) {
  if (releaseEnvironment !== "PRODUCTION") return true;
  const supplied = typeof args["approval-id"] === "string" ? args["approval-id"].trim() : "";
  const governed = process.env.NALANDA_PRODUCTION_APPROVAL_ID?.trim() || "";
  return process.env.NALANDA_PRODUCTION_RELEASE_AUTHORIZED === "true" && /^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/.test(supplied) && supplied === governed;
}

function markGate(state: ReleaseCandidateState, key: string, status: string, evidenceSafe: string) {
  const gate = state.gates.find((row) => row.key === key);
  if (!gate) throw new Error("RELEASE_GATE_UNKNOWN");
  if (!(status === "PASSED" || status === "FAILED" || status === "WAIVED")) throw new Error("RELEASE_GATE_STATUS_INVALID");
  if (evidenceSafe.length < 3 || evidenceSafe.length > 300 || /(?:password|secret|token|cookie|[A-Za-z]:\\|\/home\/|database.*hash|backup.*path)/i.test(evidenceSafe)) throw new Error("RELEASE_GATE_EVIDENCE_UNSAFE");
  gate.status = status as ReleaseGate["status"];
  gate.evidenceSafe = evidenceSafe;
  gate.checkedAt = new Date().toISOString();
}

export function rollbackRecommendation(failure: ReleaseFailure) {
  if (["PRE_PACKAGE_FAILURE", "ARTIFACT_VERIFICATION_FAILURE", "PRE_MIGRATION_FAILURE"].includes(failure)) return "Abort with no release change.";
  if (["BUILD_SWITCH_FAILURE", "STARTUP_FAILURE", "HEALTH_CHECK_FAILURE", "SMOKE_TEST_FAILURE", "CLIENT_COMPATIBILITY_FAILURE"].includes(failure)) return "Keep maintenance active and switch to the previous verified build; restore data only when the migration policy requires it.";
  if (failure === "MIGRATION_FAILURE") return "Keep maintenance active; use the verified pre-migration database and matching asset checkpoint only after confirming no new writes occurred.";
  return "Disable the responsible feature flag or escalate manual reconciliation; never restore automatically after new writes.";
}

function inspect(args: Arguments) {
  const root = stateRoot(args), releaseEnvironment = environment(args), releaseId = required(args, "release-id");
  const branch = git("branch", "--show-current"), expectedBranch = required(args, "expected-branch");
  if (branch !== expectedBranch) throw new Error("RELEASE_WRONG_BRANCH");
  if (git("status", "--porcelain")) throw new Error("RELEASE_DIRTY_TREE");
  const target = required(args, "target-release"), current = required(args, "current-release"), previous = required(args, "previous-release");
  const commit = git("rev-parse", "HEAD");
  if (typeof args["expected-commit"] === "string" && commit !== args["expected-commit"]) throw new Error("RELEASE_COMMIT_MISMATCH");
  const databasePath = path.resolve(workspaceRoot, "prisma", "dev.db");
  if (!existsSync(databasePath) || sha256File(databasePath).toLowerCase() !== required(args, "expected-database-hash").toLowerCase()) throw new Error("RELEASE_DATABASE_HASH_MISMATCH");
  const migrationSetHash = sha256Bytes(JSON.stringify(activeMigrationManifest(workspaceRoot)));
  if (migrationSetHash !== required(args, "expected-migration-set-hash").toLowerCase()) throw new Error("RELEASE_MIGRATION_SET_MISMATCH");
  const disk = releaseDiskProbe(root);
  if (disk.status === "CRITICAL") throw new Error("RELEASE_DISK_SPACE_CRITICAL");
  if (args["dry-run"] === true) return { dryRun: true, phase: "inspect", environment: releaseEnvironment, releaseId, branch, commit, databaseHashVerified: true, migrationSetVerified: true, diskStatus: disk.status };
  acquireReleaseLock({ root, owner: required(args, "owner"), session: required(args, "session"), environment: releaseEnvironment, releaseId, recoverStale: args["recover-stale-lock"] === true, recoveryReason: typeof args["recovery-reason"] === "string" ? args["recovery-reason"] : undefined });
  const classification = typeof args["migration-classification"] === "string" ? args["migration-classification"].toUpperCase() : "NONE";
  if (!isMigrationClassification(classification)) throw new Error("RELEASE_MIGRATION_CLASSIFICATION_INVALID");
  if (classification === "DESTRUCTIVE_OR_INCOMPATIBLE") throw new Error("RELEASE_DESTRUCTIVE_MIGRATION_BLOCKED");
  const state = createReleaseCandidate({ releaseId, environment: releaseEnvironment, expectedCurrentRelease: current, expectedTargetRelease: target, previousKnownGoodRelease: previous, migrationClassification: classification });
  state.featureFlags = releaseFeatureFlags().map((flag) => ({ key: flag.key, enabled: flag.defaultState, version: flag.version, environment: flag.environment }));
  markGate(state, "clean-git-tree", "PASSED", "Committed candidate tree is clean.");
  markGate(state, "expected-branch", "PASSED", "Expected retained feature branch verified.");
  writeReleaseCandidate(root, state);
  appendReleaseAudit(root, { releaseId, environment: releaseEnvironment, phase: "inspect", eventType: "CANDIDATE_CREATED", actor: required(args, "owner"), summarySafe: "Local private release candidate created from a clean committed tree." });
  return { phase: "inspect", environment: releaseEnvironment, releaseId, branch, commit, status: state.status, databaseHashVerified: true, migrationSetVerified: true, diskStatus: disk.status };
}

function prepare(args: Arguments) {
  const root = stateRoot(args), lock = assertLock(root, args), state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  const contract = validateReleaseEnvironmentContract(process.env, workspaceRoot);
  if (!contract.ok) throw new Error(`RELEASE_ENVIRONMENT_CONTRACT_FAILED:${contract.issues.map((row) => row.code).join(",")}`);
  state.status = "VALIDATING"; state.phase = "prepare";
  markGate(state, "lock-integrity", "PASSED", "Exclusive release lock and environment identity verified.");
  writeReleaseCandidate(root, state);
  appendReleaseAudit(root, { releaseId: state.releaseId, environment: state.environment, phase: "prepare", eventType: "ENVIRONMENT_VALIDATED", actor: lock.owner, summarySafe: "Release environment contract passed without exposing private configuration." });
  return { phase: "prepare", status: state.status, environment: state.environment, issues: 0, featureFlagSnapshotSha256: releaseFeatureFlagSnapshotSha256() };
}

function packagePhase(args: Arguments) {
  const root = stateRoot(args), lock = assertLock(root, args), state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  if (git("status", "--porcelain")) throw new Error("RELEASE_DIRTY_TREE");
  const outputRoot = path.resolve(root, "artifacts", state.releaseId);
  const runtimeMode = required(args, "runtime-mode");
  if (runtimeMode !== "standalone" && runtimeMode !== "framework") throw new Error("RELEASE_RUNTIME_MODE_INVALID");
  const sourceDateEpoch = required(args, "source-date-epoch");
  if (!/^\d{1,14}$/.test(sourceDateEpoch)) throw new Error("RELEASE_SOURCE_DATE_EPOCH_INVALID");
  const result = buildReleasePackage({ workspaceRoot, outputRoot, releaseId: state.releaseId, releaseChannel: required(args, "release-channel"), environment: state.environment, gitCommitSha: git("rev-parse", "HEAD"), gitTag: typeof args.tag === "string" ? args.tag : null, previousKnownGoodRelease: state.previousKnownGoodRelease, backupFormatVersion: Number(required(args, "backup-version")), runtimeMode, sourceDateEpoch });
  state.phase = "package"; writeReleaseCandidate(root, state);
  appendReleaseAudit(root, { releaseId: state.releaseId, environment: state.environment, phase: "package", eventType: "PACKAGE_CREATED", actor: lock.owner, summarySafe: "Private deployable package and bounded inventory created." });
  return { phase: "package", artifact: path.basename(result.archivePath), manifest: result.manifest, size: deploymentSizeExplanation(result.report) };
}

function verifyArtifact(args: Arguments) {
  const root = stateRoot(args), lock = assertLock(root, args), state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  const archive = path.resolve(root, "artifacts", state.releaseId, `${state.releaseId}.zip`), checksum = path.resolve(root, "artifacts", state.releaseId, `${state.releaseId}.sha256`);
  if (!existsSync(archive) || !existsSync(checksum)) throw new Error("RELEASE_ARTIFACT_MISSING");
  const expected = readFileSync(checksum, "utf8").trim().split(/\s+/)[0];
  const result = verifyReleasePackage({ archiveBytes: readFileSync(archive), expectedArchiveSha256: expected });
  markGate(state, "lock-integrity", "PASSED", "Release artifact manifest and payload checksums verified.");
  state.phase = "verify-artifact"; writeReleaseCandidate(root, state);
  appendReleaseAudit(root, { releaseId: state.releaseId, environment: state.environment, phase: "verify-artifact", eventType: "ARTIFACT_VERIFIED", actor: lock.owner, summarySafe: "Package privacy boundary, inventory and checksums verified." });
  return { phase: "verify-artifact", valid: true, fileCount: result.fileCount, archiveSha256: result.archiveSha256 };
}

function record(args: Arguments, phase: ReleasePhase) {
  const root = stateRoot(args), lock = assertLock(root, args), state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  if (["enter-maintenance", "backup", "migrate", "switch-release", "health-check", "smoke-test", "complete", "rollback"].includes(phase) && !productionMutationAllowed(args, state.environment)) throw new Error("RELEASE_PRODUCTION_EXECUTION_NOT_AUTHORIZED");
  if (state.migrationClassification === "DESTRUCTIVE_OR_INCOMPATIBLE" && ["migrate", "switch-release"].includes(phase)) throw new Error("RELEASE_DESTRUCTIVE_MIGRATION_BLOCKED");
  if (typeof args.gate === "string") markGate(state, args.gate, String(args["gate-status"] || "PASSED").toUpperCase(), required(args, "evidence"));
  if (args["rollback-owner"] !== undefined || args["rollback-deadline"] !== undefined) {
    const owner = required(args, "rollback-owner"), deadline = required(args, "rollback-deadline");
    if (!/^[A-Za-z0-9][A-Za-z0-9._@-]{2,119}$/.test(owner)) throw new Error("RELEASE_ROLLBACK_OWNER_INVALID");
    const deadlineValue = new Date(deadline).valueOf();
    if (!Number.isFinite(deadlineValue) || deadlineValue <= Date.now()) throw new Error("RELEASE_ROLLBACK_DEADLINE_INVALID");
    state.rollback = { ...state.rollback, ready: true, owner, deadline: new Date(deadlineValue).toISOString() };
  }
  if (phase === "rollback" && typeof args.failure === "string") {
    state.rollback.recommendation = rollbackRecommendation(args.failure as ReleaseFailure);
    if (state.dataWriteBoundaryCrossed && args["database-restore-approved"] !== true) throw new Error("RELEASE_POST_WRITE_DATABASE_RESTORE_REQUIRES_RECONCILIATION");
  }
  writeReleaseCandidate(root, state);
  const updated = updateReleasePhase(root, { phase, actor: lock.owner, summarySafe: typeof args.evidence === "string" ? args.evidence : `Release phase ${phase} recorded after its external evidence gate.` });
  return { phase, status: updated.status, pointOfNoReturnReached: updated.pointOfNoReturnReached, rollback: updated.rollback.recommendation };
}

function cleanup(args: Arguments) {
  const root = stateRoot(args), state = readReleaseCandidate(root);
  if (!state) throw new Error("RELEASE_CANDIDATE_MISSING");
  const audit = verifyReleaseAudit(root);
  releaseLock({ root, owner: required(args, "owner"), session: required(args, "session"), releaseId: required(args, "release-id") });
  return { phase: "inspect-cleanup", auditValid: true, auditEvents: audit.events, lockReleased: true };
}

function main() {
  const [phaseRaw, ...rest] = process.argv.slice(2);
  if (!phaseRaw || !isReleasePhase(phaseRaw)) throw new Error("RELEASE_PHASE_REQUIRED");
  const args = parseArguments(rest);
  let result: unknown;
  if (phaseRaw === "inspect") result = inspect(args);
  else if (phaseRaw === "prepare") result = prepare(args);
  else if (phaseRaw === "package") result = packagePhase(args);
  else if (phaseRaw === "verify-artifact") result = verifyArtifact(args);
  else if (phaseRaw === "inspect-cleanup") result = cleanup(args);
  else result = record(args, phaseRaw);
  console.log(JSON.stringify({ ok: true, ...result as object }));
}

try { main(); }
catch (error) {
  const message = error instanceof Error ? error.message.split("\n")[0].slice(0, 500) : "RELEASE_UNKNOWN_FAILURE";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exitCode = 1;
}
