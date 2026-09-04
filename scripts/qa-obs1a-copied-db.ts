import { PrismaClient } from "@prisma/client";
import { generateFullBackup } from "../lib/backup";
import { createMaintenanceWindow, createOperationalIncident, saveClientVersionPolicy, transitionMaintenanceWindow, transitionOperationalAlert, transitionOperationalIncident } from "../lib/operational-workflows";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { getTechnicalOperationsDashboard, runGovernedDeepChecks, upsertConditionAlert } from "../lib/technical-operations";

const prefix = "OBS1AQA";
const restoreUrl = process.env.OBS1A_RESTORE_DATABASE_URL;
if (!restoreUrl) throw new Error("OBS1A_RESTORE_DATABASE_URL_REQUIRED");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function main() {
  const source = new PrismaClient();
  const target = new PrismaClient({ datasourceUrl: restoreUrl });
  try {
    const actor = await source.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, name: true } });
    invariant(actor, "OBS1AQA_ACTIVE_SUPER_ADMIN_REQUIRED");
    invariant(await source.operationalCheckDefinition.count() === 13, "OBS1AQA_CHECK_DEFINITION_COUNT");
    const dashboard = await getTechnicalOperationsDashboard(source, { now: new Date() });
    invariant(dashboard.domains.length === 13, "OBS1AQA_DOMAIN_COUNT");
    invariant(dashboard.summaryOnly === false, "OBS1AQA_FULL_VIEW_EXPECTED");

    const deep = await runGovernedDeepChecks(source, actor.id);
    invariant(deep.length === 2 && deep.every((row) => row.status === "HEALTHY"), "OBS1AQA_DEEP_CHECK_FAILED");

    const alertOne = await upsertConditionAlert(source, { checkKey: "qa.synthetic-job", domain: "BACKGROUND_WORK_HEALTH", status: "WARNING", severity: "HIGH", titleSafe: `${prefix} synthetic job warning`, evidenceSummarySafe: "Synthetic copied-database failure injection", runbookPath: "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md" });
    invariant(alertOne, "OBS1AQA_ALERT_CREATE");
    await Promise.all(Array.from({ length: 5 }, () => upsertConditionAlert(source, { checkKey: "qa.synthetic-job", domain: "BACKGROUND_WORK_HEALTH", status: "WARNING", severity: "HIGH", titleSafe: `${prefix} synthetic job warning`, evidenceSummarySafe: "Synthetic copied-database repeated failure", runbookPath: "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md" })));
    const alertTwo = await source.operationalAlert.findUniqueOrThrow({ where: { id: alertOne.id } });
    invariant(alertTwo.occurrenceCount === 6 && await source.operationalAlert.count({ where: { fingerprint: alertTwo.fingerprint } }) === 1, "OBS1AQA_ALERT_DEDUPLICATION");
    const acknowledged = await transitionOperationalAlert(source, alertTwo.publicKey, { action: "ACKNOWLEDGE", expectedVersion: alertTwo.version }, actor.id);
    invariant(acknowledged.status === "ACKNOWLEDGED", "OBS1AQA_ALERT_ACKNOWLEDGE");
    const incident = await createOperationalIncident(source, { alertPublicKey: alertTwo.publicKey }, actor.id);
    let incidentRow = await transitionOperationalIncident(source, incident.publicKey, { action: "INVESTIGATE", expectedVersion: incident.version, note: "Synthetic copied-database investigation" }, actor.id);
    incidentRow = await transitionOperationalIncident(source, incident.publicKey, { action: "MITIGATE", expectedVersion: incidentRow.version, note: "Synthetic copied-database mitigation" }, actor.id);
    incidentRow = await transitionOperationalIncident(source, incident.publicKey, { action: "RESOLVE", expectedVersion: incidentRow.version, note: "Synthetic copied-database resolution" }, actor.id);
    incidentRow = await transitionOperationalIncident(source, incident.publicKey, { action: "CLOSE", expectedVersion: incidentRow.version, note: "Synthetic closure note", postIncidentSummary: "Synthetic condition recovered and verification passed" }, actor.id);
    invariant(incidentRow.status === "CLOSED", "OBS1AQA_INCIDENT_CLOSE");
    const recovered = await upsertConditionAlert(source, { checkKey: "qa.synthetic-job", domain: "BACKGROUND_WORK_HEALTH", status: "HEALTHY", severity: "HIGH", titleSafe: `${prefix} synthetic job warning`, evidenceSummarySafe: "Synthetic copied-database condition recovered", runbookPath: "/docs/runbooks/OBS_JOB_OUTBOX_RUNBOOK.md" });
    invariant(recovered?.status === "RESOLVED", "OBS1AQA_ALERT_AUTO_RESOLUTION");
    const critical = await upsertConditionAlert(source, { checkKey: "qa.synthetic-critical", domain: "CORE_APPLICATION_HEALTH", status: "CRITICAL", severity: "CRITICAL", titleSafe: `${prefix} synthetic critical condition`, evidenceSummarySafe: "Synthetic copied-database critical evidence", runbookPath: "/docs/runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md" });
    invariant(critical?.status === "OPEN", "OBS1AQA_CRITICAL_ALERT_CREATE");
    const campaign = await source.notificationCampaign.findFirst({ where: { campaignNumber: { startsWith: "OPS1A-CRITICAL-" } }, orderBy: { createdAt: "desc" } });
    invariant(campaign && await source.notificationRecipient.count({ where: { campaignId: campaign.id } }) >= 1, "OBS1AQA_CRITICAL_NOTIFICATION");
    await upsertConditionAlert(source, { checkKey: "qa.synthetic-critical", domain: "CORE_APPLICATION_HEALTH", status: "HEALTHY", severity: "CRITICAL", titleSafe: `${prefix} synthetic critical condition`, evidenceSummarySafe: "Synthetic copied-database critical condition recovered", runbookPath: "/docs/runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md" });
    const alertsBeforeOptional = await source.operationalAlert.count();
    await upsertConditionAlert(source, { checkKey: "qa.optional-provider", domain: "PROVIDER_CONFIGURATION_HEALTH", status: "NOT_CONFIGURED", severity: "CRITICAL", titleSafe: `${prefix} optional provider state`, evidenceSummarySafe: "Optional provider is intentionally not configured", runbookPath: "/docs/OBS_PROVIDER_STATUS_POLICY.md" });
    invariant(await source.operationalAlert.count() === alertsBeforeOptional, "OBS1AQA_OPTIONAL_PROVIDER_FALSE_ALERT");

    const now = new Date();
    let window = await createMaintenanceWindow(source, { domain: "BACKGROUND_WORK_HEALTH", checkKeys: ["qa.synthetic-job"], reason: "Synthetic maintenance rehearsal", expectedImpact: "Synthetic job check only", plannedStartAt: new Date(now.valueOf() + 60_000).toISOString(), plannedEndAt: new Date(now.valueOf() + 3_600_000).toISOString() }, actor.id, now);
    window = await transitionMaintenanceWindow(source, window.publicKey, { action: "START", expectedVersion: window.version, note: "Synthetic window started" }, actor.id, new Date(now.valueOf() + 60_000));
    window = await transitionMaintenanceWindow(source, window.publicKey, { action: "COMPLETE", expectedVersion: window.version, note: "Synthetic window complete" }, actor.id, new Date(now.valueOf() + 120_000));
    invariant(window.status === "COMPLETED", "OBS1AQA_MAINTENANCE_COMPLETE");

    const policy = await saveClientVersionPolicy(source, { environment: "local", currentVersion: "1.0.0", minimumSupportedVersion: "1.0.0", updateAvailableVersion: "1.0.1", updateMessage: "Synthetic advisory update", enforcementMode: "ADVISORY" }, actor.id);
    const policyTwo = await saveClientVersionPolicy(source, { environment: "local", currentVersion: "1.0.1", minimumSupportedVersion: "1.0.0", enforcementMode: "ADVISORY", expectedVersion: policy.version }, actor.id);
    invariant(policyTwo.version === 2, "OBS1AQA_CLIENT_POLICY_VERSION");

    await source.releaseManifest.create({ data: { releaseVersion: `${prefix}-checkpoint`, environment: "local", gitCommit: "synthetic", buildId: "synthetic", migrationVersion: "20260810100000_technical_operations_observability", backupVersion: 42, pwaBuildId: "synthetic", applicationSchemaId: "synthetic", isCurrent: false, createdByUserId: actor.id } });
    const backup = parseAndValidateBackup(await generateFullBackup(source as never, { generatedBy: prefix }));
    invariant(backup.metadata.backupVersion === 45, "OBS1AQA_BACKUP_VERSION");
    invariant(backup.technicalOperations.operationalAlerts.length === 2 && backup.technicalOperations.operationalIncidents.length === 1, "OBS1AQA_BACKUP_HISTORY");
    invariant(!containsProhibitedField(backup.technicalOperations), "OBS1AQA_BACKUP_PRIVATE_FIELD");

    const targetActor = await target.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true, name: true } });
    invariant(targetActor, "OBS1AQA_RESTORE_ACTOR");
    const first = await restoreValidatedBackup(target, backup, targetActor);
    const countsAfterFirst = await technicalCounts(target);
    const second = await restoreValidatedBackup(target, backup, targetActor);
    const countsAfterSecond = await technicalCounts(target);
    invariant(first.technicalOperations.errors.length === 0 && second.technicalOperations.errors.length === 0, "OBS1AQA_RESTORE_ERRORS");
    invariant(JSON.stringify(countsAfterFirst) === JSON.stringify(countsAfterSecond), "OBS1AQA_RESTORE_DUPLICATES");
    invariant(countsAfterSecond.alerts === 2 && countsAfterSecond.incidents === 1 && countsAfterSecond.maintenance === 1 && countsAfterSecond.policies === 1, "OBS1AQA_RESTORE_COUNTS");
    const integrity = await target.$queryRawUnsafe<Array<Record<string, string>>>("PRAGMA quick_check");
    const foreignKeys = await target.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    invariant(integrity.every((row) => Object.values(row).includes("ok")), "OBS1AQA_RESTORE_QUICK_CHECK");
    invariant(foreignKeys.length === 0, "OBS1AQA_RESTORE_FOREIGN_KEYS");
    console.log(JSON.stringify({ status: "OBS1AQA_COPIED_DATABASE_PASSED", domains: dashboard.domains.length, deepChecks: deep.length, definitions: 13, backupVersion: backup.metadata.backupVersion, restored: countsAfterSecond, duplicateRestore: false, privacySafe: true }));
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

async function technicalCounts(client: PrismaClient) {
  const [definitions, alerts, alertEvents, incidents, incidentEvents, maintenance, maintenanceEvents, manifests, policies] = await Promise.all([
    client.operationalCheckDefinition.count(), client.operationalAlert.count(), client.operationalAlertEvent.count(), client.operationalIncident.count(), client.operationalIncidentEvent.count(), client.maintenanceWindow.count(), client.maintenanceWindowEvent.count(), client.releaseManifest.count(), client.clientVersionPolicy.count()
  ]);
  return { definitions, alerts, alertEvents, incidents, incidentEvents, maintenance, maintenanceEvents, manifests, policies };
}

function containsProhibitedField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsProhibitedField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => /password|secret|credential|token|absolutePath|payload/i.test(key) || containsProhibitedField(child));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "OBS1AQA_FAILED"); process.exitCode = 1; });
