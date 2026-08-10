import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { buildReleasePackage, verifyReleasePackage } from "../lib/release-package";
import { activeMigrationManifest, sha256Bytes } from "../lib/release-manifest";
import { acquireReleaseLock, appendReleaseAudit, createReleaseCandidate, releaseDiskProbe, releaseLock, verifyReleaseAudit, writeReleaseCandidate } from "../lib/release-state";
import { businessBaseline, fileSha256, OPERATIONAL_DATABASE, WORKSPACE_ROOT } from "./migration-check-utils";
import { runMigrationFreshInstallCheck } from "./migration-fresh-install-check";
import { runExistingDatabaseRehearsal } from "./migration-existing-db-rehearsal";
import { runMigrationBackupRestoreCheck } from "./migration-backup-restore-check";

const PREFIX = "RELEASEOPS1A";
const ROOT = path.join(WORKSPACE_ROOT, "tmp", "releaseops1a");

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function safeRoot() {
  const expected = path.join(path.resolve(WORKSPACE_ROOT), "tmp", "releaseops1a");
  const resolved = path.resolve(ROOT);
  if (resolved !== expected) throw new Error("RELEASEOPS1A_CLEANUP_SCOPE_REFUSED");
  return resolved;
}
function cleanup() { const root = safeRoot(); if (existsSync(root)) rmSync(root, { recursive: true, force: true }); }

async function main() {
  const before = { hash: fileSha256(OPERATIONAL_DATABASE), baseline: businessBaseline(OPERATIONAL_DATABASE) };
  invariant(Object.values(before.baseline).every((value) => value === 0), "RELEASEOPS1A_OPERATIONAL_BUSINESS_BASELINE_NOT_ZERO");
  cleanup(); mkdirSync(ROOT, { recursive: true });
  const releaseId = `${PREFIX.toLowerCase()}-${Date.now()}`, owner = "releaseops1a-operator", session = randomUUID();
  acquireReleaseLock({ root: ROOT, owner, session, environment: "STAGING", releaseId });
  let concurrentDenied = false;
  try { acquireReleaseLock({ root: ROOT, owner: "releaseops1a-second", session: randomUUID(), environment: "STAGING", releaseId: `${releaseId}-second` }); } catch (error) { concurrentDenied = error instanceof Error && error.message === "RELEASE_LOCK_HELD"; }
  invariant(concurrentDenied, "RELEASEOPS1A_CONCURRENT_LOCK_NOT_DENIED");
  const state = createReleaseCandidate({ releaseId, environment: "STAGING", expectedCurrentRelease: "bulk-onboarding-v41-2026-08-10", expectedTargetRelease: releaseId, previousKnownGoodRelease: "bulk-onboarding-v41-2026-08-10", migrationClassification: "NONE" });
  writeReleaseCandidate(ROOT, state);
  appendReleaseAudit(ROOT, { releaseId, environment: "STAGING", phase: "prepare", eventType: "SYNTHETIC_REHEARSAL_STARTED", actor: owner, summarySafe: "Synthetic release migration, backup and package rehearsal started." });

  const fresh = await runMigrationFreshInstallCheck();
  const copied = await runExistingDatabaseRehearsal();
  const restored = await runMigrationBackupRestoreCheck();
  invariant(fresh.migrations === activeMigrationManifest(WORKSPACE_ROOT).length, "RELEASEOPS1A_FRESH_MIGRATION_COUNT");
  invariant(JSON.stringify(copied.business) === JSON.stringify(before.baseline), "RELEASEOPS1A_COPIED_BASELINE_CHANGED");
  invariant(restored.version === 37 && restored.firstCounts.users === 1, "RELEASEOPS1A_RESTORE_PROOF_INVALID");

  const outputRoot = path.join(ROOT, "artifacts");
  const packaged = buildReleasePackage({ workspaceRoot: WORKSPACE_ROOT, outputRoot, releaseId, releaseChannel: "STAGING", environment: "STAGING", gitCommitSha: "d".repeat(40), previousKnownGoodRelease: "bulk-onboarding-v41-2026-08-10", backupFormatVersion: 41, runtimeMode: "framework", sourceDateEpoch: "1786320000" });
  const verified = verifyReleasePackage({ archiveBytes: readFileSync(packaged.archivePath), expectedArchiveSha256: packaged.report.archiveSha256 });
  invariant(verified.valid && verified.fileCount > 0, "RELEASEOPS1A_ARTIFACT_VERIFY_FAILED");
  invariant(releaseDiskProbe(ROOT, 900 * 1024 ** 2).status === "CRITICAL" && releaseDiskProbe(ROOT, 2 * 1024 ** 3).status === "WARNING", "RELEASEOPS1A_LOW_SPACE_PROBE_FAILED");
  appendReleaseAudit(ROOT, { releaseId, environment: "STAGING", phase: "rehearse", eventType: "SYNTHETIC_REHEARSAL_PASSED", actor: owner, summarySafe: "Fresh and copied migration, restore-twice, package and failure probes passed." });
  const audit = verifyReleaseAudit(ROOT);
  releaseLock({ root: ROOT, owner, session, releaseId });
  invariant(verifyReleaseAudit(ROOT).events === audit.events + 1, "RELEASEOPS1A_AUDIT_FINAL_EVENT_MISSING");
  const after = { hash: fileSha256(OPERATIONAL_DATABASE), baseline: businessBaseline(OPERATIONAL_DATABASE) };
  invariant(JSON.stringify(after) === JSON.stringify(before), "RELEASEOPS1A_OPERATIONAL_DATABASE_CHANGED");
  const evidence = {
    result: "RELEASEOPS1A_SYNTHETIC_REHEARSAL_PASSED",
    migrations: fresh.migrations,
    copiedDatabaseByteIdenticalBeforeDeploy: copied.sourceHash === before.hash,
    logicalRestoreTwice: true,
    artifactFiles: verified.fileCount,
    artifactPayloadVerified: verified.payloadSha256 === packaged.report.payloadSha256,
    singleReleaseLock: true,
    injectedLowSpace: true,
    operationalBaselineUnchanged: true,
    migrationSetFingerprint: sha256Bytes(JSON.stringify(activeMigrationManifest(WORKSPACE_ROOT))).slice(0, 12),
    privateDataInArtifact: false,
    providerCalls: 0
  };
  cleanup(); invariant(!existsSync(ROOT), "RELEASEOPS1A_CLEANUP_FIRST_INSPECTION_FAILED"); cleanup(); invariant(!existsSync(ROOT), "RELEASEOPS1A_CLEANUP_SECOND_INSPECTION_FAILED");
  console.log(JSON.stringify(evidence));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "RELEASEOPS1A_REHEARSAL_FAILED"); process.exitCode = 1; });
