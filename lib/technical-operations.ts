import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statfsSync, statSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import packageJson from "../package.json";
import { PWA_BUILD_VERSION } from "@/lib/pwa-version";
import { validateDeploymentEnvironment } from "@/lib/deployment-environment";
import { safeErrorFingerprint } from "@/lib/safe-logging";
import { publishCriticalOperationalAlertNotification } from "@/lib/operational-alert-notifications";
import {
  OPERATIONAL_DOMAINS,
  operationalDomainLabel,
  worstOperationalStatus,
  type ClientVersionState,
  type DomainHealthCard,
  type OperationalDomain,
  type OperationalStatus,
  type ProviderHealthItem,
  type TechnicalOperationsDashboard
} from "@/lib/technical-operations-types";

type DatabaseClient = PrismaClient;
type MigrationRow = { migration_name: string; finished_at: Date | string | null; rolled_back_at: Date | string | null };
type CountRow = { count: bigint | number };

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie"
} as const;
const STATUS_OPEN = ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "SILENCED"];
const BACKUP_VERSION = 44;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function technicalOperationsPrivateHeaders() {
  return PRIVATE_HEADERS;
}

export function stableOperationalFingerprint(parts: Array<string | number | null | undefined>) {
  const safe = parts.map((value) => String(value ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-")).join(":");
  return createHash("sha256").update(safe).digest("hex");
}

export async function getTechnicalOperationsDashboard(
  client: DatabaseClient,
  options: { summaryOnly?: boolean; now?: Date } = {}
): Promise<TechnicalOperationsDashboard> {
  const now = options.now ?? new Date();
  const summaryOnly = Boolean(options.summaryOnly);
  const [database, migrations, protection, storage, security, work, documents, providers, release, business, deployment, lifecycle] = await Promise.all([
    databaseHealth(client, now),
    migrationHealth(client, now),
    dataProtectionHealth(client, now),
    storageHealth(now),
    securityHealth(client, now),
    backgroundHealth(client, now),
    documentHealth(client, now),
    providerHealth(client),
    releaseHealth(client),
    businessIntegrityHealth(client),
    deploymentHealth(),
    loadOperationalLifecycle(client, now, summaryOnly)
  ]);

  const core: DomainHealthCard = domainCard("CORE_APPLICATION_HEALTH", database.reachable ? "HEALTHY" : "CRITICAL", now,
    database.reachable ? "The application process and database connection are available." : "The application cannot reach its configured database.",
    database.reachable ? "No action is required." : "Use the core/database runbook before restarting or changing data.",
    "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md",
    [{ label: "Process", value: "Available", status: "HEALTHY" }, { label: "Release metadata", value: release.gitCommit === "unknown" ? "Unavailable" : "Available", status: release.gitCommit === "unknown" ? "UNKNOWN" : "HEALTHY" }]);

  const domains: DomainHealthCard[] = [
    core,
    database.card,
    migrations.card,
    protection.card,
    storage.card,
    security.card,
    work.backgroundCard,
    work.notificationCard,
    documents.card,
    release.card,
    providerDomainCard(providers, now),
    business.card,
    deployment.card
  ];
  const coreApplication = worstOperationalStatus([core.status, database.card.status, migrations.card.status]);
  const operationalReadiness = worstOperationalStatus(domains.filter((row) => !["PROVIDER_CONFIGURATION_HEALTH", "DEPLOYMENT_READINESS"].includes(row.domain)).map((row) => row.status));
  const optionalProviders = providers.some((row) => ["FAILED", "DEGRADED"].includes(row.state)) ? "WARNING" : providers.every((row) => ["NOT_CONFIGURED", "DISABLED"].includes(row.state)) ? "NOT_CONFIGURED" : "HEALTHY";
  const overall = worstOperationalStatus([coreApplication, operationalReadiness]);

  return {
    generatedAt: now.toISOString(),
    summaryOnly,
    conclusions: {
      coreApplication,
      operationalReadiness,
      deploymentReadiness: deployment.card.status,
      optionalProviders,
      overall,
      explanation: deployment.card.status === "HEALTHY"
        ? "Core health and deployment readiness are separate dimensions; all configured release gates currently pass."
        : "Core application checks can pass while production release remains blocked by deployment, recovery, provider or policy gates."
    },
    domains: summaryOnly ? domains.filter((row) => ["CORE_APPLICATION_HEALTH", "DATA_PROTECTION_HEALTH", "RELEASE_AND_CLIENT_VERSION_HEALTH", "DEPLOYMENT_READINESS"].includes(row.domain)) : domains,
    adoption: security.adoption,
    providers: summaryOnly ? [] : providers,
    release: release.summary,
    alerts: lifecycle.alerts,
    incidents: lifecycle.incidents,
    maintenanceWindows: summaryOnly ? [] : lifecycle.maintenanceWindows
  };
}

async function databaseHealth(client: DatabaseClient, now: Date) {
  let reachable = false;
  let status: OperationalStatus = "CRITICAL";
  let dbBytes = 0;
  let residueCount = 0;
  let expectedLocation = false;
  try {
    await client.$queryRawUnsafe("SELECT 1 AS ok");
    reachable = true;
    status = "HEALTHY";
    const dbPath = operationalDatabasePath();
    expectedLocation = isWithinWorkspace(dbPath);
    dbBytes = statSync(dbPath).size;
    residueCount = ["-wal", "-shm", "-journal"].filter((suffix) => existsSync(`${dbPath}${suffix}`) && statSync(`${dbPath}${suffix}`).size > 0).length;
    if (!expectedLocation || residueCount > 0) status = "WARNING";
  } catch {
    reachable = false;
  }
  return {
    reachable,
    card: domainCard("DATABASE_HEALTH", status, now,
      reachable ? "The operational database is reachable; only aggregate file health is shown." : "The operational database is unavailable.",
      status === "HEALTHY" ? "Run the governed deep check on schedule." : "Review database location and journal residue before changing data.",
      "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md",
      [
        { label: "Reachable", value: reachable ? "Yes" : "No", status: reachable ? "HEALTHY" : "CRITICAL" },
        { label: "Expected location", value: expectedLocation ? "Yes" : "No", status: expectedLocation ? "HEALTHY" : "CRITICAL" },
        { label: "Database size", value: formatBytes(dbBytes) },
        { label: "Active journal artifacts", value: residueCount, status: residueCount ? "WARNING" : "HEALTHY" }
      ])
  };
}

async function migrationHealth(client: DatabaseClient, now: Date) {
  try {
    const rows = await client.$queryRawUnsafe<MigrationRow[]>("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC");
    const repository = migrationDirectories();
    const applied = rows.filter((row) => row.finished_at && !row.rolled_back_at);
    const failed = rows.filter((row) => !row.finished_at || row.rolled_back_at);
    const pending = Math.max(0, repository.length - applied.length);
    const status: OperationalStatus = failed.length || pending ? "CRITICAL" : "HEALTHY";
    return { rows, repository, card: domainCard("MIGRATION_HEALTH", status, now,
      status === "HEALTHY" ? "Repository and applied migration counts agree." : "Pending, failed or rolled-back migration evidence requires attention.",
      status === "HEALTHY" ? "No migration action is required." : "Stop release work and follow the database/migration runbook.",
      "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md",
      [{ label: "Repository migrations", value: repository.length }, { label: "Applied", value: applied.length }, { label: "Pending", value: pending, status: pending ? "CRITICAL" : "HEALTHY" }, { label: "Failed or rolled back", value: failed.length, status: failed.length ? "CRITICAL" : "HEALTHY" }]) };
  } catch {
    return { rows: [], repository: migrationDirectories(), card: domainCard("MIGRATION_HEALTH", "UNKNOWN", now, "Migration metadata is unavailable.", "Run the governed migration status command.", "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md", []) };
  }
}

async function dataProtectionHealth(client: DatabaseClient, now: Date) {
  const logical = latestLogicalBackup();
  const latestCloudRun = await caught(() => client.cloudBackupRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }));
  const rehearsal = await caught(() => client.cloudBackupRestoreRehearsal.findFirst({ where: { status: "PASSED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }));
  const latestBackupAt = maxDate(logical?.mtime ?? null, latestCloudRun?.completedAt ?? null);
  const backupAgeHours = latestBackupAt ? Math.floor((now.valueOf() - latestBackupAt.valueOf()) / HOUR) : null;
  const restoreAgeDays = rehearsal?.completedAt ? Math.floor((now.valueOf() - rehearsal.completedAt.valueOf()) / DAY) : null;
  const backupStatus: OperationalStatus = backupAgeHours == null ? "CRITICAL" : backupAgeHours > 168 ? "WARNING" : "HEALTHY";
  const restoreStatus: OperationalStatus = restoreAgeDays == null ? "WARNING" : restoreAgeDays > 90 ? "WARNING" : "HEALTHY";
  const status = worstOperationalStatus([backupStatus, restoreStatus]);
  return { card: domainCard("DATA_PROTECTION_HEALTH", status, now,
    restoreAgeDays == null ? "A backup is not treated as recovery proof because no stored restore-rehearsal record is available." : "Backup freshness and restore rehearsal are evaluated independently.",
    status === "HEALTHY" ? "Continue the governed backup and rehearsal cadence." : "Create or verify a backup, then rehearse restoration in isolated storage.",
    "/docs/runbooks/OBS_BACKUP_RESTORE_RUNBOOK.md",
    [
      { label: "Latest backup age", value: backupAgeHours == null ? "Missing" : `${backupAgeHours} hours`, status: backupStatus },
      { label: "Restore rehearsal age", value: restoreAgeDays == null ? "Not stored" : `${restoreAgeDays} days`, status: restoreStatus },
      { label: "Backup format", value: `Version ${BACKUP_VERSION}` }
    ]) };
}

async function storageHealth(now: Date) {
  try {
    const root = process.cwd();
    const fs = statfsSync(root);
    const total = fs.blocks * fs.bsize;
    const available = fs.bavail * fs.bsize;
    const usedPercent = total > 0 ? Math.round(((total - available) / total) * 1000) / 10 : 0;
    const warning = boundedPercent(process.env.OBS_STORAGE_WARNING_PERCENT, 80);
    const critical = boundedPercent(process.env.OBS_STORAGE_CRITICAL_PERCENT, 90);
    const status: OperationalStatus = usedPercent >= critical ? "CRITICAL" : usedPercent >= warning ? "WARNING" : "HEALTHY";
    const approved = approvedStorageRoots().map((entry) => ({ label: entry.label, ...boundedDirectoryAggregate(entry.path) }));
    return { card: domainCard("STORAGE_CAPACITY_HEALTH", status, now,
      "Capacity and approved-directory aggregates are reported without filenames or owners.",
      status === "HEALTHY" ? "No storage action is required." : "Follow the low-disk runbook; do not delete private data from this dashboard.",
      "/docs/runbooks/OBS_LOW_STORAGE_RUNBOOK.md",
      [
        { label: "Used", value: `${usedPercent}%`, status },
        { label: "Available", value: formatBytes(available) },
        { label: "Approved directory usage", value: formatBytes(approved.reduce((sum, row) => sum + row.bytes, 0)) },
        { label: "Stale temporary artifacts", value: approved.reduce((sum, row) => sum + row.staleFiles, 0), status: approved.some((row) => row.staleFiles) ? "WARNING" : "HEALTHY" }
      ]) };
  } catch {
    return { card: domainCard("STORAGE_CAPACITY_HEALTH", "UNKNOWN", now, "Storage capacity could not be measured safely.", "Use the local low-storage runbook.", "/docs/runbooks/OBS_LOW_STORAGE_RUNBOOK.md", []) };
  }
}

async function securityHealth(client: DatabaseClient, now: Date) {
  const dayAgo = new Date(now.valueOf() - DAY);
  const weekAgo = new Date(now.valueOf() - 7 * DAY);
  const [activeSessions, sessions24h, sessions7d, neverLoggedIn, disabledOrPending, activeSuperAdmins, unownedPrivileged, roleRows, eventRows] = await Promise.all([
    client.authSession.findMany({ where: { revokedAt: null, expiresAt: { gt: now } }, select: { userId: true, activeRoleAssignmentId: true, user: { select: { role: true } } } }),
    client.authSession.findMany({ where: { lastSeenAt: { gte: dayAgo } }, distinct: ["userId"], select: { userId: true } }),
    client.authSession.findMany({ where: { lastSeenAt: { gte: weekAgo } }, distinct: ["userId"], select: { userId: true, user: { select: { role: true } } } }),
    client.user.count({ where: { lastLoginAt: null } }),
    client.user.count({ where: { OR: [{ isActive: false }, { lifecycleStatus: { not: "ACTIVE" } }] } }),
    client.user.count({ where: { role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE" } }),
    client.user.count({ where: { role: { in: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"] }, OR: [{ designation: null }, { name: "" }] } }),
    client.user.groupBy({ by: ["role"], _count: { _all: true }, where: { isActive: true } }),
    client.authSecurityEvent.groupBy({ by: ["eventType"], _count: { _all: true }, where: { createdAt: { gte: weekAgo } } })
  ]);
  const eventCount = (name: string) => eventRows.find((row) => row.eventType === name)?._count._all ?? 0;
  const status: OperationalStatus = activeSuperAdmins === 0 ? "CRITICAL" : unownedPrivileged > 0 || eventCount("LOGIN_FAILED") >= 10 ? "WARNING" : "HEALTHY";
  const roles = new Set([...activeSessions.map((row) => row.user.role), ...sessions7d.map((row) => row.user.role)]);
  const adoption = {
    activeSessions: activeSessions.length,
    uniqueUsers24h: sessions24h.length,
    uniqueUsers7d: sessions7d.length,
    neverLoggedIn,
    disabledOrPending,
    roleGroups: [...roles].sort().map((role) => ({
      label: roleGroupLabel(role),
      activeSessions: activeSessions.filter((row) => row.user.role === role).length,
      users7d: new Set(sessions7d.filter((row) => row.user.role === role).map((row) => row.userId)).size
    }))
  };
  return { adoption, card: domainCard("SECURITY_AND_AUTH_HEALTH", status, now,
    "Account adoption and security activity is aggregate-only and is not an employee-performance view.",
    status === "HEALTHY" ? "Review trends and privileged ownership on schedule." : "Review privileged-account ownership and recent security-event counts.",
    "/docs/runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md",
    [
      { label: "Active sessions", value: activeSessions.length },
      { label: "Active Super Admins", value: activeSuperAdmins, status: activeSuperAdmins ? "HEALTHY" : "CRITICAL" },
      { label: "Failed logins (7 days)", value: eventCount("LOGIN_FAILED") },
      { label: "Rate limits (7 days)", value: eventCount("LOGIN_RATE_LIMITED") },
      { label: "Disabled-account attempts", value: eventCount("DISABLED_ACCOUNT_LOGIN_ATTEMPT") },
      { label: "Unowned privileged accounts", value: unownedPrivileged, status: unownedPrivileged ? "WARNING" : "HEALTHY" },
      { label: "Active role groups", value: roleRows.length }
    ]) };
}

async function backgroundHealth(client: DatabaseClient, now: Date) {
  const [whatsapp, smsEmail, safeExit, cloud, generic, onboardingBatches, onboardingAudits, onboardingJobs] = await Promise.all([
    statusCounts(client, "WhatsAppDelivery"),
    statusCounts(client, "SmsEmailDelivery"),
    statusCounts(client, "StudentDepartureNotificationOutbox"),
    statusCounts(client, "CloudBackupRun"),
    statusCounts(client, "BackgroundJobRun"),
    statusCounts(client, "OnboardingBatch"),
    statusCounts(client, "OnboardingAuditEvent", "eventType"),
    onboardingJobMetrics(client)
  ]);
  const combined = mergeStatusCounts(whatsapp, smsEmail, safeExit, cloud, generic);
  const queued = sumStatuses(combined, ["QUEUED", "PENDING", "SCHEDULED"]);
  const retrying = sumStatuses(combined, ["RETRYING", "RETRY_SCHEDULED"]);
  const failed = sumStatuses(combined, ["FAILED", "DEAD_LETTER", "ATTENTION_REQUIRED"]);
  const status: OperationalStatus = failed ? "WARNING" : retrying ? "DEGRADED" : "HEALTHY";
  const metrics = [
    { label: "Queued", value: queued },
    { label: "Retrying", value: retrying },
    { label: "Failed / attention", value: failed, status: failed ? "WARNING" as const : "HEALTHY" as const },
    { label: "Onboarding awaiting validation", value: (onboardingBatches.UPLOADED ?? 0) + (onboardingBatches.VALIDATED ?? 0) },
    { label: "Onboarding awaiting approval", value: onboardingBatches.APPROVAL_REQUIRED ?? 0 },
    { label: "Onboarding awaiting execution", value: onboardingBatches.APPROVED ?? 0 },
    { label: "Onboarding recovery required", value: onboardingBatches.RECOVERY_REQUIRED ?? 0, status: onboardingBatches.RECOVERY_REQUIRED ? "WARNING" as const : "HEALTHY" as const },
    { label: "Onboarding validations passed", value: onboardingJobs.validationCompleted },
    { label: "Onboarding validations refused", value: onboardingJobs.validationFailed, status: onboardingJobs.validationFailed ? "WARNING" as const : "HEALTHY" as const },
    { label: "Onboarding executions passed", value: onboardingJobs.executionCompleted },
    { label: "Onboarding executions failed", value: onboardingJobs.executionFailed, status: onboardingJobs.executionFailed ? "WARNING" as const : "HEALTHY" as const },
    { label: "Onboarding duplicate/replay suppressions", value: onboardingJobs.replayCount },
    { label: "Onboarding rollback blocks", value: onboardingAudits.ROLLBACK_PREVIEW_BLOCKED ?? 0, status: onboardingAudits.ROLLBACK_PREVIEW_BLOCKED ? "WARNING" as const : "HEALTHY" as const }
  ];
  return {
    backgroundCard: domainCard("BACKGROUND_WORK_HEALTH", status, now, "Existing jobs and outboxes are aggregated without recipient, document, payment or message data.", status === "HEALTHY" ? "No action is required." : "Inspect privacy-safe failure fingerprints and follow the job/outbox runbook.", "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md", metrics),
    notificationCard: domainCard("NOTIFICATION_DELIVERY_HEALTH", status, now, "In-app and optional delivery queues remain separate from provider activation.", status === "HEALTHY" ? "No delivery backlog requires attention." : "Inspect the affected queue without exposing recipients or payloads.", "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md", metrics)
  };
}

async function documentHealth(client: DatabaseClient, now: Date) {
  const [ocr, reportCards, payslips, admissions, classwork] = await Promise.all([
    statusCounts(client, "FeeRegisterOcrBatch"),
    statusCounts(client, "ReportCardBatch"),
    statusCounts(client, "StaffPayslipDocumentVersion"),
    statusCounts(client, "ApplicationDocument"),
    statusCounts(client, "ClassworkAttachment", "recoveryStatus")
  ]);
  const combined = mergeStatusCounts(ocr, reportCards, payslips, admissions, classwork);
  const failed = sumStatuses(combined, ["FAILED", "ERROR", "REJECTED_INVALID_FILE", "QUARANTINED"]);
  const processing = sumStatuses(combined, ["PROCESSING", "RUNNING", "QUEUED", "PENDING"]);
  const status: OperationalStatus = failed ? "WARNING" : "HEALTHY";
  return { card: domainCard("DOCUMENT_PROCESSING_HEALTH", status, now,
    "Only aggregate document-processing states are shown; content, filenames, marks, salary, passwords and paths are excluded.",
    status === "HEALTHY" ? "Continue synthetic self-tests and cleanup checks." : "Use the job/outbox runbook and inspect only safe fingerprints.",
    "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md",
    [{ label: "Processing / queued", value: processing }, { label: "Failed / quarantined", value: failed, status: failed ? "WARNING" : "HEALTHY" }]) };
}

async function providerHealth(client: DatabaseClient): Promise<ProviderHealthItem[]> {
  const [whatsapp, smsEmail, cloud, ocr, push] = await Promise.all([
    caught(() => client.whatsAppIntegrationProfile.findMany({ select: { status: true, mode: true, liveSendingEnabled: true, lastHealthCheckAt: true, lastHealthCheckStatus: true } })),
    caught(() => client.smsEmailIntegrationProfile.findMany({ select: { status: true, mode: true, liveSendingEnabled: true, lastHealthCheckAt: true, lastHealthCheckStatus: true, channel: true } })),
    caught(() => client.cloudBackupProfile.findMany({ select: { status: true, providerKind: true, liveUseEnabled: true, lastHealthCheckAt: true, lastHealthCheckStatus: true } })),
    caught(() => client.feeRegisterOcrProfile.findMany({ select: { status: true, providerKind: true, liveUseEnabled: true } })),
    caught(() => client.appPushSubscription.count({ where: { status: "ACTIVE" } }))
  ]);
  const categories = [
    providerFromRows("WhatsApp", whatsapp ?? []),
    providerFromRows("SMS / Email", smsEmail ?? []),
    providerFromRows("Cloud backup", cloud ?? []),
    providerFromRows("OCR", ocr ?? []),
    fixedProvider("Web Push", push ? "TEST" : "DISABLED", Boolean(push)),
    fixedProvider("Online payment", "NOT_CONFIGURED", false),
    fixedProvider("AI", process.env.AI_PROVIDER_MODE === "MOCK" ? "TEST" : "NOT_CONFIGURED", process.env.AI_PROVIDER_MODE === "MOCK"),
    fixedProvider("External monitoring", "NOT_CONFIGURED", false),
    fixedProvider("Analytics", "NOT_CONFIGURED", false)
  ];
  return categories;
}

async function releaseHealth(client: DatabaseClient) {
  const migrations = await caught(() => client.$queryRawUnsafe<MigrationRow[]>("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC")) ?? [];
  const current = await caught(() => client.releaseManifest.findFirst({ where: { isCurrent: true }, orderBy: { createdAt: "desc" } }));
  const policy = await caught(() => client.clientVersionPolicy.findUnique({ where: { environment: runtimeEnvironment() } }));
  const migrationVersion = migrations.find((row) => row.finished_at && !row.rolled_back_at)?.migration_name ?? "unknown";
  const gitCommit = safeTechnicalVersion(current?.gitCommit || process.env.NALANDA_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || "unknown");
  const buildId = safeTechnicalVersion(current?.buildId || process.env.NALANDA_BUILD_ID || PWA_BUILD_VERSION);
  const schemaVersion = fileDigest(path.join(process.cwd(), "prisma", "schema.prisma")).slice(0, 12);
  const serverVersion = safeTechnicalVersion(current?.releaseVersion || packageJson.version);
  const clientState = evaluateClientVersion(serverVersion, policy?.currentVersion, policy?.minimumSupportedVersion, policy?.updateAvailableVersion);
  const summary = {
    serverVersion,
    environment: runtimeEnvironment(),
    gitCommit,
    buildId,
    migrationVersion,
    migrationCount: migrations.filter((row) => row.finished_at && !row.rolled_back_at).length,
    backupVersion: current?.backupVersion ?? BACKUP_VERSION,
    pwaBuildId: safeTechnicalVersion(current?.pwaBuildId || PWA_BUILD_VERSION),
    applicationSchemaVersion: safeTechnicalVersion(current?.applicationSchemaId || schemaVersion),
    clientState,
    staleClientCount: 0,
    policyVersion: policy?.version ?? null,
    policyCurrentVersion: policy?.currentVersion ?? null,
    minimumSupportedVersion: policy?.minimumSupportedVersion ?? null,
    updateAvailableVersion: policy?.updateAvailableVersion ?? null
  };
  const status: OperationalStatus = clientState === "UPDATE_REQUIRED" ? "CRITICAL" : clientState === "UNKNOWN" ? "UNKNOWN" : clientState === "UPDATE_AVAILABLE" ? "WARNING" : "HEALTHY";
  return { ...summary, summary, card: domainCard("RELEASE_AND_CLIENT_VERSION_HEALTH", status, new Date(),
    "Server, migration, backup, PWA and advisory client-policy versions are reported without forcing refresh.",
    status === "HEALTHY" ? "No client action is required." : "Review the release/client policy; deployment remains a separate governed phase.",
    "/docs/OBS_CLIENT_RELEASE_VERSION_SPECIFICATION.md",
    [{ label: "Server release", value: serverVersion }, { label: "Migration", value: migrationVersion }, { label: "Backup format", value: summary.backupVersion }, { label: "PWA build", value: summary.pwaBuildId }, { label: "Client state", value: clientState, status }]) };
}

async function businessIntegrityHealth(client: DatabaseClient) {
  const latest = await caught(() => client.operationalCheckRun.findFirst({ where: { definition: { checkKey: "business.integrity" } }, orderBy: { completedAt: "desc" }, select: { status: true, completedAt: true, summarySafe: true, evidenceSummaryJson: true } }));
  const status = operationalStatus(latest?.status, "UNKNOWN");
  return { card: domainCard("BUSINESS_INTEGRITY_HEALTH", status, latest?.completedAt ?? null,
    latest?.summarySafe ?? "Business-integrity checks have not yet been run in this environment.",
    latest ? "Open the governed runbook for any affected count; no automatic repair is available." : "Run the governed deep business-integrity check.",
    "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md", safeMetrics(latest?.evidenceSummaryJson)) };
}

async function deploymentHealth() {
  const result = validateDeploymentEnvironment(process.env, process.cwd());
  const intentionallyLocal = !process.env.NALANDA_ENVIRONMENT || process.env.NALANDA_ENVIRONMENT === "local";
  const status: OperationalStatus = result.ok ? "HEALTHY" : intentionallyLocal ? "WARNING" : "CRITICAL";
  return { card: domainCard("DEPLOYMENT_READINESS", status, new Date(),
    result.ok ? "The configured deployment environment contract passes." : intentionallyLocal ? "This local-only environment is operational but is not configured for production deployment." : "One or more deployment contract gates fail.",
    result.ok ? "Continue only through the governed release workflow." : "Do not deploy; review the deployment-readiness runbook and environment contract.",
    "/docs/OBSERVABILITY_OPERATIONS_ARCHITECTURE.md",
    [{ label: "Environment", value: intentionallyLocal ? "Local only" : result.environment }, { label: "Blocking gates", value: result.issues.length, status }]) };
}

async function loadOperationalLifecycle(client: DatabaseClient, now: Date, summaryOnly: boolean) {
  const [alerts, incidents, maintenanceWindows] = await Promise.all([
    client.operationalAlert.findMany({ where: { status: { in: STATUS_OPEN } }, orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }], take: summaryOnly ? 10 : 100, select: { publicKey: true, domain: true, severity: true, status: true, titleSafe: true, evidenceSummarySafe: true, runbookPath: true, firstSeenAt: true, lastSeenAt: true, occurrenceCount: true, silencedUntil: true, version: true } }),
    client.operationalIncident.findMany({ where: { status: { not: "CLOSED" } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: summaryOnly ? 10 : 100, select: { publicKey: true, incidentNumber: true, domain: true, severity: true, status: true, titleSafe: true, summarySafe: true, runbookPath: true, createdAt: true, updatedAt: true, version: true } }),
    client.maintenanceWindow.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] }, plannedEndAt: { gte: new Date(now.valueOf() - DAY) } }, orderBy: { plannedStartAt: "asc" }, take: 100, select: { publicKey: true, domain: true, status: true, reasonSafe: true, expectedImpactSafe: true, plannedStartAt: true, plannedEndAt: true, version: true } })
  ]);
  return { alerts, incidents, maintenanceWindows };
}

export async function runGovernedDeepChecks(client: DatabaseClient, actorUserId: string, now = new Date(), injected?: { databaseIntegrity?: OperationalStatus; storage?: OperationalStatus }) {
  const started = Date.now();
  const definitions = await client.operationalCheckDefinition.findMany({ where: { checkType: "DEEP", enabled: true }, orderBy: { checkKey: "asc" } });
  const results: Array<{ checkKey: string; status: OperationalStatus; summarySafe: string; affectedCount: number }> = [];
  for (const definition of definitions) {
    let status: OperationalStatus = "HEALTHY";
    let summarySafe = "The governed deep check passed.";
    let affectedCount = 0;
    try {
      if (definition.checkKey === "database.integrity") {
        if (injected?.databaseIntegrity) status = injected.databaseIntegrity;
        else {
          const integrity = await client.$queryRawUnsafe<Array<{ quick_check: string }>>("PRAGMA quick_check");
          const foreignKeys = await client.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
          affectedCount = foreignKeys.length + (integrity.every((row) => row.quick_check === "ok") ? 0 : 1);
          status = affectedCount ? "CRITICAL" : "HEALTHY";
        }
        summarySafe = status === "HEALTHY" ? "SQLite integrity and foreign-key checks passed." : "SQLite integrity or foreign-key evidence requires immediate attention.";
      } else if (definition.checkKey === "business.integrity") {
        const checks = await businessInvariantCounts(client);
        affectedCount = checks.reduce((sum, row) => sum + row.affectedCount, 0);
        status = affectedCount ? "CRITICAL" : "HEALTHY";
        summarySafe = affectedCount ? "One or more count-only business integrity checks found contradictory records." : "Count-only business integrity checks passed.";
      }
    } catch (error) {
      status = "CRITICAL";
      summarySafe = "The governed deep check failed safely.";
      await recordCheckRun(client, definition.id, definition.checkKey, status, summarySafe, actorUserId, now, started, { affectedCount: 0 }, error);
      results.push({ checkKey: definition.checkKey, status, summarySafe, affectedCount: 0 });
      continue;
    }
    await recordCheckRun(client, definition.id, definition.checkKey, status, summarySafe, actorUserId, now, started, { affectedCount });
    await upsertConditionAlert(client, {
      checkKey: definition.checkKey, domain: definition.domain as OperationalDomain, status, severity: definition.severityOnFailure,
      titleSafe: `${definition.name} requires attention`, evidenceSummarySafe: summarySafe, runbookPath: definition.runbookPath
    }, now);
    results.push({ checkKey: definition.checkKey, status, summarySafe, affectedCount });
  }
  return results;
}

async function recordCheckRun(client: DatabaseClient, definitionId: string, checkKey: string, status: OperationalStatus, summarySafe: string, actorUserId: string, now: Date, started: number, evidence: Record<string, number>, error?: unknown) {
  return client.operationalCheckRun.create({ data: {
    runKey: `obs-${now.valueOf()}-${randomUUID()}`,
    definitionId, status, triggerType: "MANUAL", summarySafe,
    evidenceSummaryJson: JSON.stringify(evidence),
    errorFingerprint: error ? safeErrorFingerprint(error, checkKey) : null,
    durationMs: Date.now() - started,
    actorUserId,
    completedAt: new Date(),
    expiresAt: new Date(now.valueOf() + 365 * DAY)
  } });
}

export async function upsertConditionAlert(client: DatabaseClient, input: { checkKey: string; domain: OperationalDomain; status: OperationalStatus; severity: string; titleSafe: string; evidenceSummarySafe: string; runbookPath: string }, now = new Date()) {
  const fingerprint = stableOperationalFingerprint([input.domain, input.checkKey]);
  const current = await client.operationalAlert.findUnique({ where: { fingerprint } });
  if (input.status === "HEALTHY" || input.status === "NOT_CONFIGURED") {
    if (!current || ["RESOLVED", "CLOSED"].includes(current.status)) return current;
    return client.$transaction(async (tx) => {
      const changed = await tx.operationalAlert.updateMany({ where: { id: current.id, version: current.version }, data: { status: "RESOLVED", resolvedAt: now, resolutionSummarySafe: "The monitored condition recovered.", lastSeenAt: now, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("OPERATIONAL_ALERT_STALE_VERSION");
      await tx.operationalAlertEvent.create({ data: { alertId: current.id, eventType: "AUTO_RESOLVED", previousStatus: current.status, newStatus: "RESOLVED", notesSafe: "The monitored condition recovered.", occurrence: current.occurrenceCount, occurredAt: now } });
      return tx.operationalAlert.findUnique({ where: { id: current.id } });
    });
  }
  const outcome = await client.$transaction(async (tx) => {
    const before = await tx.operationalAlert.findUnique({ where: { fingerprint } });
    const alert = before
      ? await tx.operationalAlert.update({ where: { id: before.id }, data: { severity: severityValue(input.severity), status: ["CLOSED", "RESOLVED"].includes(before.status) ? "OPEN" : before.status, titleSafe: safeSummary(input.titleSafe, 160), evidenceSummarySafe: safeSummary(input.evidenceSummarySafe, 500), runbookPath: safeRunbook(input.runbookPath), lastSeenAt: now, occurrenceCount: { increment: 1 }, version: { increment: 1 }, resolvedAt: null, resolutionSummarySafe: null, closedAt: null, closedByUserId: null } })
      : await tx.operationalAlert.create({ data: { fingerprint, checkKey: input.checkKey, domain: input.domain, severity: severityValue(input.severity), titleSafe: safeSummary(input.titleSafe, 160), evidenceSummarySafe: safeSummary(input.evidenceSummarySafe, 500), runbookPath: safeRunbook(input.runbookPath), firstSeenAt: now, lastSeenAt: now } });
    await tx.operationalAlertEvent.create({ data: { alertId: alert.id, eventType: before ? "OCCURRENCE_RECORDED" : "OPENED", previousStatus: before?.status ?? null, newStatus: alert.status, occurrence: alert.occurrenceCount, occurredAt: now } });
    return { alert, notify: !before || ["RESOLVED", "CLOSED"].includes(before.status) };
  });
  if (input.severity === "CRITICAL" && outcome.notify) {
    await publishCriticalOperationalAlertNotification(client, outcome.alert, now);
  }
  return outcome.alert;
}

async function businessInvariantCounts(client: DatabaseClient) {
  const queries: Array<{ key: string; query: string }> = [
    { key: "orphan_enrollment", query: "SELECT COUNT(*) AS count FROM AcademicYearEnrollment e LEFT JOIN Student s ON s.id=e.studentId WHERE s.id IS NULL" },
    { key: "payment_receipt", query: "SELECT COUNT(*) AS count FROM Payment WHERE isCancelled=0 AND (receiptNo IS NULL OR TRIM(receiptNo)='')" },
    { key: "family_total", query: "SELECT COUNT(*) AS count FROM FamilyCollection c WHERE c.totalPaise <> COALESCE((SELECT SUM(i.amountPaise) FROM FamilyCollectionInstrument i WHERE i.collectionId=c.id),0)" },
    { key: "duplicate_report_publication", query: "SELECT COUNT(*) AS count FROM (SELECT studentId,academicYear,COUNT(*) n FROM StudentReportCard WHERE status='ISSUED' GROUP BY studentId,academicYear HAVING n>1)" },
    { key: "duplicate_active_payroll", query: "SELECT COUNT(*) AS count FROM (SELECT periodId,COUNT(*) n FROM PayrollRun WHERE status IN ('APPROVED','LOCKED','PAYSLIPS_ISSUED') GROUP BY periodId HAVING n>1)" },
    { key: "parent_context_without_relationship", query: "SELECT COUNT(*) AS count FROM AuthSession s LEFT JOIN StudentGuardian g ON g.id=s.activeChildLinkId WHERE s.activeChildLinkId IS NOT NULL AND g.id IS NULL" },
    { key: "broken_private_asset", query: "SELECT SUM(total) AS count FROM (SELECT COUNT(*) total FROM ApplicationDocument WHERE LENGTH(sha256)<>64 OR recoveryStatus IN ('FAILED','HASH_MISMATCH','MISSING') UNION ALL SELECT COUNT(*) FROM ClassworkAttachment WHERE LENGTH(sha256)<>64 OR recoveryStatus IN ('FAILED','HASH_MISMATCH','MISSING') UNION ALL SELECT COUNT(*) FROM SupportRequestAttachment WHERE LENGTH(sha256)<>64 OR recoveryStatus IN ('FAILED','HASH_MISMATCH','MISSING') UNION ALL SELECT COUNT(*) FROM StaffPayslipDocumentVersion WHERE LENGTH(sourceSha256)<>64 OR LENGTH(derivativeSha256)<>64)" },
    { key: "safe_exit_release_without_evidence", query: "SELECT COUNT(*) AS count FROM StudentDepartureRequest r WHERE r.status IN ('CHECKED_OUT','RETURN_EXPECTED','RETURNED_TO_CAMPUS','CLOSED') AND (r.checkedOutAt IS NULL OR NOT EXISTS (SELECT 1 FROM StudentDepartureHandover h WHERE h.requestId=r.id) OR NOT EXISTS (SELECT 1 FROM StudentGatePass p WHERE p.requestId=r.id AND p.status='USED' AND p.consumedAt IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM StudentCampusPresenceEvent c WHERE c.requestId=r.id AND c.eventType='EARLY_DEPARTURE'))" },
    { key: "migration_backup_mismatch", query: "SELECT COUNT(*) AS count FROM ReleaseManifest WHERE isCurrent=1 AND (backupVersion<>44 OR migrationVersion<>'20260825090000_offline_sync_1a')" }
  ];
  const result: Array<{ checkKey: string; affectedCount: number }> = [];
  for (const row of queries) {
    const values = await client.$queryRawUnsafe<CountRow[]>(row.query);
    result.push({ checkKey: row.key, affectedCount: Number(values[0]?.count ?? 0) });
  }
  return result;
}

function domainCard(domain: OperationalDomain, status: OperationalStatus, checkedAt: Date | string | null, explanation: string, action: string, runbookPath: string, metrics: DomainHealthCard["metrics"]): DomainHealthCard {
  return { domain, label: operationalDomainLabel(domain), status, lastCheckedAt: checkedAt ? new Date(checkedAt).toISOString() : null, explanation, action, runbookPath, metrics };
}

function providerDomainCard(providers: ProviderHealthItem[], now: Date): DomainHealthCard {
  const failed = providers.filter((row) => row.state === "FAILED").length;
  const degraded = providers.filter((row) => row.state === "DEGRADED").length;
  const configured = providers.filter((row) => !["NOT_CONFIGURED", "DISABLED"].includes(row.state)).length;
  const status: OperationalStatus = failed ? "WARNING" : degraded ? "DEGRADED" : configured ? "HEALTHY" : "NOT_CONFIGURED";
  return domainCard("PROVIDER_CONFIGURATION_HEALTH", status, now,
    configured ? "Configured provider categories are reported without secrets, recipients or payloads." : "Optional providers are intentionally not configured; this is not a core application failure.",
    failed || degraded ? "Review the provider runbook without activating or probing external services automatically." : "No provider activation is required for local operation.",
    "/docs/OBS_PROVIDER_STATUS_POLICY.md",
    [{ label: "Configured/test", value: configured }, { label: "Not configured / disabled", value: providers.length - configured }, { label: "Failed", value: failed, status: failed ? "WARNING" : "HEALTHY" }]);
}

function providerFromRows(category: string, sourceRows: object[]): ProviderHealthItem {
  const rows = sourceRows as Array<Record<string, unknown>>;
  if (!rows.length) return fixedProvider(category, "NOT_CONFIGURED", false);
  const live = rows.some((row) => row.liveUseEnabled === true || row.liveSendingEnabled === true || row.mode === "LIVE");
  const failed = rows.some((row) => row.lastHealthCheckStatus === "FAILED" || row.status === "FAILED");
  const degraded = rows.some((row) => row.lastHealthCheckStatus === "DEGRADED");
  const state = failed ? "FAILED" : degraded ? "DEGRADED" : live ? "LIVE" : "TEST";
  const lastHealth = rows.map((row) => row.lastHealthCheckAt).filter((value): value is Date => value instanceof Date).sort((a, b) => b.valueOf() - a.valueOf())[0] ?? null;
  return { category, environment: runtimeEnvironment(), state, enabled: rows.some((row) => !["DISABLED", "PAUSED"].includes(String(row.status))), configurationComplete: true, lastHealthAt: lastHealth?.toISOString() ?? null, lastSuccessAt: null, failureCount: failed ? 1 : 0, explanation: live ? "Configured LIVE; no network check was made while rendering." : "Configured for local/test use; no network check was made while rendering." };
}

function fixedProvider(category: string, state: ProviderHealthItem["state"], enabled: boolean): ProviderHealthItem {
  return { category, environment: runtimeEnvironment(), state, enabled, configurationComplete: state !== "NOT_CONFIGURED", lastHealthAt: null, lastSuccessAt: null, failureCount: state === "FAILED" ? 1 : 0, explanation: state === "NOT_CONFIGURED" ? "Intentionally not configured." : state === "DISABLED" ? "Configured feature is disabled." : "Local/test configuration only." };
}

type StatusTable = "WhatsAppDelivery" | "SmsEmailDelivery" | "StudentDepartureNotificationOutbox" | "CloudBackupRun" | "BackgroundJobRun" | "OnboardingBatch" | "OnboardingAuditEvent" | "FeeRegisterOcrBatch" | "ReportCardBatch" | "StaffPayslipDocumentVersion" | "ApplicationDocument" | "ClassworkAttachment";

async function statusCounts(client: DatabaseClient, table: StatusTable, column: "status" | "recoveryStatus" | "eventType" = "status") {
  try {
    // Both identifiers are closed, compile-time allowlists; no request input reaches this query.
    const rows = await client.$queryRawUnsafe<Array<{ status: string; total: bigint | number }>>(
      `SELECT "${column}" AS status, COUNT(*) AS total FROM "${table}" GROUP BY "${column}"`
    );
    return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.total ?? 0)]));
  } catch {
    return {};
  }
}

async function onboardingJobMetrics(client: DatabaseClient) {
  try {
    const rows = await client.$queryRawUnsafe<Array<{ jobType: string; status: string; total: bigint | number; attempts: bigint | number }>>(
      "SELECT jobType, status, COUNT(*) AS total, SUM(attemptCount) AS attempts FROM BackgroundJobRun WHERE component = 'GOVERNED_BULK_ONBOARDING' GROUP BY jobType, status"
    );
    const count = (types: string[], status: string) => rows.filter((row) => types.includes(row.jobType) && row.status === status).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    return {
      validationCompleted: count(["ONBOARDING_WORKBOOK_PARSE", "ONBOARDING_VALIDATION"], "COMPLETED"),
      validationFailed: count(["ONBOARDING_WORKBOOK_PARSE", "ONBOARDING_VALIDATION"], "FAILED"),
      executionCompleted: count(["ONBOARDING_EXECUTION"], "COMPLETED"),
      executionFailed: count(["ONBOARDING_EXECUTION"], "FAILED"),
      replayCount: rows.reduce((sum, row) => sum + Math.max(0, Number(row.attempts ?? 0) - Number(row.total ?? 0)), 0)
    };
  } catch {
    return { validationCompleted: 0, validationFailed: 0, executionCompleted: 0, executionFailed: 0, replayCount: 0 };
  }
}

function mergeStatusCounts(...rows: Array<Record<string, number>>) {
  const result: Record<string, number> = {};
  for (const row of rows) for (const [key, value] of Object.entries(row)) result[key] = (result[key] ?? 0) + value;
  return result;
}

function sumStatuses(counts: Record<string, number>, statuses: string[]) {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

function latestLogicalBackup() {
  const configured = process.env.BACKUP_DIRECTORY?.trim();
  const root = path.resolve(configured || path.join(process.cwd(), "backups"));
  if (!isWithinWorkspace(root) || !existsSync(root)) return null;
  return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => statSync(path.join(root, entry.name))).sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null;
}

function approvedStorageRoots() {
  const root = process.cwd();
  const candidates = [
    ["Operational database", path.dirname(operationalDatabasePath())],
    ["Backups", path.resolve(process.env.BACKUP_DIRECTORY?.trim() || path.join(root, "backups"))],
    ["Private uploads", path.resolve(process.env.ADMISSIONS_PRIVATE_STORAGE_ROOT?.trim() || path.join(root, "data", "private"))],
    ["Governed onboarding private workbooks", path.resolve(process.env.ONBOARDING_STORAGE_ROOT?.trim() || path.join(root, "storage", "onboarding"))],
    ["Generated documents", path.resolve(process.env.PAYSLIP_PRIVATE_STORAGE_ROOT?.trim() || path.join(root, "data", "generated"))],
    ["Temporary processing", path.resolve(process.env.CLOUD_BACKUP_TEMP_DIR?.trim() || path.join(root, "tmp"))],
    ["Application cache", path.join(root, ".next")]
  ] as const;
  return candidates.filter(([, target]) => isWithinWorkspace(target)).map(([label, target]) => ({ label, path: target }));
}

function boundedDirectoryAggregate(root: string) {
  if (!existsSync(root)) return { bytes: 0, files: 0, staleFiles: 0, truncated: false };
  const stack = [root]; let bytes = 0; let files = 0; let staleFiles = 0; let truncated = false;
  while (stack.length && files < 5000) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile()) {
        const stat = statSync(target); files++; bytes += stat.size;
        if ((/tmp|temp|cache/i.test(root) || /\.tmp$/i.test(entry.name)) && Date.now() - stat.mtimeMs > 7 * DAY) staleFiles++;
      }
      if (files >= 5000) { truncated = true; break; }
    }
  }
  return { bytes, files, staleFiles, truncated };
}

function operationalDatabasePath() {
  const value = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  if (!value.startsWith("file:") || value.includes("?")) throw new Error("OPERATIONAL_DATABASE_PATH_UNSUPPORTED");
  return path.resolve(process.cwd(), "prisma", value.slice(5));
}

function isWithinWorkspace(target: string) {
  const root = path.resolve(process.cwd());
  const relative = path.relative(root, path.resolve(target));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function migrationDirectories() {
  const root = path.join(process.cwd(), "prisma", "migrations");
  return existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
}

function fileDigest(file: string) {
  try { return createHash("sha256").update(readFileSync(file)).digest("hex"); } catch { return "unknown"; }
}

function runtimeEnvironment() {
  return safeTechnicalVersion(process.env.NALANDA_ENVIRONMENT || process.env.NODE_ENV || "local");
}

function safeTechnicalVersion(value: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120);
  return normalized || "unknown";
}

function evaluateClientVersion(server: string, current?: string | null, minimum?: string | null, available?: string | null): ClientVersionState {
  if (!current || !minimum) return "UNKNOWN";
  if (compareVersions(server, minimum) < 0) return "UPDATE_REQUIRED";
  if (available && compareVersions(server, available) < 0) return "UPDATE_AVAILABLE";
  return "CURRENT";
}

function compareVersions(left: string, right: string) {
  const a = left.split(/[^0-9]+/).filter(Boolean).map(Number), b = right.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) { const diff = (a[index] ?? 0) - (b[index] ?? 0); if (diff) return diff; }
  return 0;
}

function operationalStatus(value: string | null | undefined, fallback: OperationalStatus): OperationalStatus {
  return (["HEALTHY", "DEGRADED", "WARNING", "CRITICAL", "UNKNOWN", "NOT_CONFIGURED", "MAINTENANCE"] as string[]).includes(String(value)) ? value as OperationalStatus : fallback;
}

function safeMetrics(json: string | null | undefined): DomainHealthCard["metrics"] {
  try {
    const value = JSON.parse(json || "{}") as Record<string, unknown>;
    return Object.entries(value).filter(([, entry]) => typeof entry === "number").slice(0, 8).map(([key, entry]) => ({ label: key.replaceAll("_", " "), value: Number(entry) }));
  } catch { return []; }
}

function safeSummary(value: string, maximum: number) {
  const result = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!result || result.length > maximum || /(?:password|secret|token|cookie|salary|mark|guardian|payment reference|[a-z]:\\|\/home\/)/i.test(result)) throw new Error("OPERATIONAL_PRIVATE_SUMMARY_REFUSED");
  return result;
}

function safeRunbook(value: string) {
  const result = value.trim();
  if (!/^\/(?:docs|technical-operations)(?:\/[A-Za-z0-9._-]+)*\.?(?:md)?$/.test(result)) throw new Error("OPERATIONAL_RUNBOOK_PATH_INVALID");
  return result.slice(0, 240);
}

function severityValue(value: string) {
  return ["INFO", "WARNING", "HIGH", "CRITICAL"].includes(value) ? value : "HIGH";
}

function roleGroupLabel(role: string) {
  if (role === "PARENT") return "Parents";
  if (["TEACHER", "COMPUTER_OPERATOR", "GATE_STAFF", "ACCOUNTANT", "ADMIN"].includes(role)) return "Teachers and Staff";
  if (["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) return "Leadership";
  if (role === "STUDENT") return "Students";
  return "Other authorised accounts";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"]; const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${Math.round((value / 1024 ** index) * 10) / 10} ${units[index]}`;
}

function boundedPercent(value: string | undefined, fallback: number) {
  const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 1 && parsed <= 99 ? parsed : fallback;
}

function maxDate(...values: Array<Date | null>) {
  return values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.valueOf() - a.valueOf())[0] ?? null;
}

async function caught<T>(work: () => Promise<T>): Promise<T | null> {
  try { return await work(); } catch { return null; }
}
