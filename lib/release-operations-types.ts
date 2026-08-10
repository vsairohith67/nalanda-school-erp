export const RELEASE_ENVIRONMENTS = ["DEVELOPMENT", "TEST", "PREVIEW", "STAGING", "PRODUCTION"] as const;
export type ReleaseEnvironment = (typeof RELEASE_ENVIRONMENTS)[number];

export const RELEASE_STATUSES = [
  "DRAFT", "VALIDATING", "READY_FOR_STAGING", "STAGING", "STAGING_ACCEPTED",
  "READY_FOR_PRODUCTION", "RELEASING", "RELEASED", "FAILED", "ROLLED_BACK", "SUPERSEDED"
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_PHASES = [
  "inspect", "prepare", "package", "verify-artifact", "rehearse", "enter-maintenance",
  "backup", "migrate", "switch-release", "health-check", "smoke-test", "complete",
  "rollback", "inspect-cleanup"
] as const;
export type ReleasePhase = (typeof RELEASE_PHASES)[number];

export const RELEASE_FAILURES = [
  "PRE_PACKAGE_FAILURE", "ARTIFACT_VERIFICATION_FAILURE", "PRE_MIGRATION_FAILURE",
  "MIGRATION_FAILURE", "BUILD_SWITCH_FAILURE", "STARTUP_FAILURE", "HEALTH_CHECK_FAILURE",
  "SMOKE_TEST_FAILURE", "CLIENT_COMPATIBILITY_FAILURE", "POST_RELEASE_OPERATIONAL_FAILURE"
] as const;
export type ReleaseFailure = (typeof RELEASE_FAILURES)[number];

export const MIGRATION_CLASSIFICATIONS = [
  "NONE", "ADDITIVE_BACKWARD_COMPATIBLE", "ADDITIVE_REQUIRES_NEW_CODE",
  "DATA_BACKFILL_REQUIRED", "DESTRUCTIVE_OR_INCOMPATIBLE"
] as const;
export type MigrationClassification = (typeof MIGRATION_CLASSIFICATIONS)[number];

export const CLIENT_UPDATE_STATES = [
  "CURRENT", "UPDATE_AVAILABLE", "UPDATE_RECOMMENDED", "UPDATE_REQUIRED", "INCOMPATIBLE", "UNKNOWN"
] as const;
export type ClientUpdateState = (typeof CLIENT_UPDATE_STATES)[number];

export const UPDATE_SEVERITIES = ["NONE", "AVAILABLE", "RECOMMENDED", "REQUIRED", "CRITICAL"] as const;
export type UpdateSeverity = (typeof UPDATE_SEVERITIES)[number];

export type ReleaseMigration = { name: string; sha256: string };
export type ReleaseAsset = { path: string; bytes: number; sha256: string };

export type ReleaseManifestDocument = {
  contractVersion: 1;
  releaseId: string;
  applicationVersion: string;
  releaseChannel: string;
  gitCommitSha: string;
  gitTag: string | null;
  buildId: string;
  buildTimestamp: string;
  nodeVersion: string;
  packageManagerVersion: string;
  lockfileSha256: string;
  prismaSchemaSha256: string;
  appliedMigrations: ReleaseMigration[];
  applicationSchemaFingerprint: string;
  backupFormatVersion: number;
  publicStaticAssets: ReleaseAsset[];
  pwaBuildId: string;
  privateAssetSchemaVersion: string;
  compatibilityContractVersion: string;
  minimumSupportedWebClient: string;
  featureFlagSnapshotSha256: string;
  environment: ReleaseEnvironment;
  releaseArtifactSha256: string | null;
  previousKnownGoodRelease: string;
};

export type ReleaseGate = {
  key: string;
  status: "PENDING" | "PASSED" | "FAILED" | "WAIVED";
  evidenceSafe: string | null;
  checkedAt: string | null;
};

export type ReleaseAuditEvent = {
  sequence: number;
  occurredAt: string;
  releaseId: string;
  environment: ReleaseEnvironment;
  phase: ReleasePhase;
  eventType: string;
  actor: string;
  summarySafe: string;
  previousHash: string | null;
  eventHash: string;
};

export type ReleaseCandidateState = {
  contractVersion: 1;
  releaseId: string;
  environment: ReleaseEnvironment;
  status: ReleaseStatus;
  expectedCurrentRelease: string;
  expectedTargetRelease: string;
  migrationClassification: MigrationClassification;
  phase: ReleasePhase;
  pointOfNoReturnReached: boolean;
  dataWriteBoundaryCrossed: boolean;
  previousKnownGoodRelease: string;
  gates: ReleaseGate[];
  featureFlags: Array<{ key: string; enabled: boolean; version: number; environment: ReleaseEnvironment }>;
  maintenance: { active: boolean; startsAt: string | null; endsAt: string | null; reasonSafe: string | null };
  client: { buildId: string; minimumSupportedVersion: string; updateSeverity: UpdateSeverity };
  rollback: { ready: boolean; owner: string | null; deadline: string | null; recommendation: string };
  updatedAt: string;
};

export const REQUIRED_RELEASE_GATES = [
  "clean-git-tree", "expected-branch", "reviewed-commit", "git-safety", "lock-integrity",
  "typecheck", "focused-tests", "full-tests", "production-build", "route-api-inventory",
  "migration-validation", "fresh-install", "copied-database", "synthetic-staging",
  "backup-created", "restore-rehearsed", "security-scan", "browser-smoke", "pwa-cache",
  "obs-health", "release-notes", "rollback-package", "named-approver", "maintenance-window"
] as const;

export function releaseGateTemplate(): ReleaseGate[] {
  return REQUIRED_RELEASE_GATES.map((key) => ({ key, status: "PENDING", evidenceSafe: null, checkedAt: null }));
}

export function isReleaseEnvironment(value: string): value is ReleaseEnvironment {
  return (RELEASE_ENVIRONMENTS as readonly string[]).includes(value);
}

export function isReleasePhase(value: string): value is ReleasePhase {
  return (RELEASE_PHASES as readonly string[]).includes(value);
}

export function isMigrationClassification(value: string): value is MigrationClassification {
  return (MIGRATION_CLASSIFICATIONS as readonly string[]).includes(value);
}
