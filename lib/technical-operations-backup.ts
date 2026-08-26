import type { PrismaClient } from "@prisma/client";
import { databaseColumnExists } from "@/lib/database-capabilities";

export const TECHNICAL_OPERATIONS_BACKUP_KEYS = [
  "operationalCheckDefinitions",
  "operationalAlerts",
  "operationalAlertEvents",
  "operationalIncidents",
  "operationalIncidentEvents",
  "maintenanceWindows",
  "maintenanceWindowEvents",
  "releaseManifests",
  "clientVersionPolicies"
] as const;

export type TechnicalOperationsBackupKey = typeof TECHNICAL_OPERATIONS_BACKUP_KEYS[number];
export type TechnicalOperationsBackup = Record<TechnicalOperationsBackupKey, Array<Record<string, unknown>>>;

const ALLOWED_KEYS: Record<TechnicalOperationsBackupKey, ReadonlySet<string>> = {
  operationalCheckDefinitions: new Set(["id", "checkKey", "name", "domain", "checkType", "cadence", "enabled", "protectedCritical", "severityOnFailure", "descriptionSafe", "runbookPath", "retentionDays", "createdAt", "updatedAt"]),
  operationalAlerts: new Set(["id", "publicKey", "fingerprint", "checkKey", "domain", "severity", "status", "titleSafe", "evidenceSummarySafe", "runbookPath", "firstSeenAt", "lastSeenAt", "occurrenceCount", "acknowledgedByUserId", "acknowledgedAt", "silencedByUserId", "silencedAt", "silencedUntil", "silenceReasonSafe", "resolvedByUserId", "resolvedAt", "resolutionSummarySafe", "closedByUserId", "closedAt", "version", "createdAt", "updatedAt"]),
  operationalAlertEvents: new Set(["id", "alertId", "eventType", "previousStatus", "newStatus", "notesSafe", "actorUserId", "occurrence", "occurredAt", "createdAt"]),
  operationalIncidents: new Set(["id", "publicKey", "incidentNumber", "alertId", "domain", "severity", "status", "titleSafe", "summarySafe", "ownerUserId", "runbookPath", "mitigationSafe", "resolutionSummarySafe", "postIncidentSummarySafe", "version", "resolvedAt", "closedAt", "createdByUserId", "createdAt", "updatedAt"]),
  operationalIncidentEvents: new Set(["id", "incidentId", "eventType", "previousStatus", "newStatus", "notesSafe", "actorUserId", "version", "occurredAt", "createdAt"]),
  maintenanceWindows: new Set(["id", "publicKey", "domain", "checkKeysJson", "status", "reasonSafe", "expectedImpactSafe", "ownerUserId", "plannedStartAt", "plannedEndAt", "actualStartAt", "actualEndAt", "version", "createdAt", "updatedAt"]),
  maintenanceWindowEvents: new Set(["id", "maintenanceWindowId", "eventType", "notesSafe", "actorUserId", "version", "occurredAt", "createdAt"]),
  releaseManifests: new Set(["id", "releaseVersion", "environment", "gitCommit", "buildId", "migrationVersion", "backupVersion", "pwaBuildId", "applicationSchemaId", "isCurrent", "createdByUserId", "createdAt"]),
  clientVersionPolicies: new Set(["id", "environment", "currentVersion", "minimumSupportedVersion", "updateAvailableVersion", "updateMessageSafe", "enforcementMode", "version", "updatedByUserId", "createdAt", "updatedAt"])
};

export function emptyTechnicalOperationsBackup(): TechnicalOperationsBackup {
  return Object.fromEntries(TECHNICAL_OPERATIONS_BACKUP_KEYS.map((key) => [key, []])) as unknown as TechnicalOperationsBackup;
}

export function technicalOperationsRecordCount(backup: TechnicalOperationsBackup) {
  return TECHNICAL_OPERATIONS_BACKUP_KEYS.reduce((total, key) => total + backup[key].length, 0);
}

export async function technicalOperationsSchemaAvailable(client: Partial<Pick<PrismaClient, "$queryRaw">>) {
  if (!(client as any).operationalCheckDefinition?.findMany) return false;
  if (typeof client.$queryRaw !== "function") return false;
  return databaseColumnExists(client, "OperationalCheckDefinition", "checkKey");
}

export async function loadTechnicalOperationsBackup(client: PrismaClient): Promise<TechnicalOperationsBackup> {
  const [operationalCheckDefinitions, operationalAlerts, operationalAlertEvents, operationalIncidents, operationalIncidentEvents, maintenanceWindows, maintenanceWindowEvents, releaseManifests, clientVersionPolicies] = await Promise.all([
    client.operationalCheckDefinition.findMany({ orderBy: [{ domain: "asc" }, { checkKey: "asc" }] }),
    client.operationalAlert.findMany({ orderBy: [{ firstSeenAt: "asc" }, { id: "asc" }] }),
    client.operationalAlertEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }),
    client.operationalIncident.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.operationalIncidentEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }),
    client.maintenanceWindow.findMany({ orderBy: [{ plannedStartAt: "asc" }, { id: "asc" }] }),
    client.maintenanceWindowEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }),
    client.releaseManifest.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    client.clientVersionPolicy.findMany({ orderBy: [{ environment: "asc" }, { id: "asc" }] })
  ]);
  return validateTechnicalOperationsBackup({ operationalCheckDefinitions, operationalAlerts, operationalAlertEvents, operationalIncidents, operationalIncidentEvents, maintenanceWindows, maintenanceWindowEvents, releaseManifests, clientVersionPolicies });
}

export function validateTechnicalOperationsBackup(value: unknown): TechnicalOperationsBackup {
  if (value === undefined || value === null) return emptyTechnicalOperationsBackup();
  if (!isRecord(value)) throw new Error("technicalOperations must be an object");
  const unknown = Object.keys(value).filter((key) => !TECHNICAL_OPERATIONS_BACKUP_KEYS.includes(key as TechnicalOperationsBackupKey));
  if (unknown.length) throw new Error("technicalOperations contains unsupported fields");
  return Object.fromEntries(TECHNICAL_OPERATIONS_BACKUP_KEYS.map((key) => {
    const rows = value[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 100_000) throw new Error(`technicalOperations.${key} must be a bounded array`);
    return [key, rows.map((row, index) => validateRow(key, row, index))];
  })) as TechnicalOperationsBackup;
}

export async function restoreTechnicalOperationsBackup(client: PrismaClient, backup: TechnicalOperationsBackup) {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const restore = async (key: TechnicalOperationsBackupKey, model: { findFirst(args: object): Promise<unknown>; create(args: object): Promise<unknown> }, uniqueWhere: (row: Record<string, unknown>) => object) => {
    for (const [index, row] of backup[key].entries()) {
      try {
        if (await model.findFirst({ where: uniqueWhere(row), select: { id: true } })) {
          result.skipped++;
          continue;
        }
        await model.create({ data: row });
        result.created++;
      } catch {
        result.errors.push(`${key}[${index}] could not be restored safely`);
      }
    }
  };

  await restore("operationalCheckDefinitions", client.operationalCheckDefinition, (row) => ({ OR: [{ id: row.id }, { checkKey: row.checkKey }] }));
  await restore("operationalAlerts", client.operationalAlert, (row) => ({ OR: [{ id: row.id }, { publicKey: row.publicKey }, { fingerprint: row.fingerprint }] }));
  await restore("operationalAlertEvents", client.operationalAlertEvent, (row) => ({ id: row.id }));
  await restore("operationalIncidents", client.operationalIncident, (row) => ({ OR: [{ id: row.id }, { publicKey: row.publicKey }, { incidentNumber: row.incidentNumber }] }));
  await restore("operationalIncidentEvents", client.operationalIncidentEvent, (row) => ({ id: row.id }));
  await restore("maintenanceWindows", client.maintenanceWindow, (row) => ({ OR: [{ id: row.id }, { publicKey: row.publicKey }] }));
  await restore("maintenanceWindowEvents", client.maintenanceWindowEvent, (row) => ({ id: row.id }));
  await restore("releaseManifests", client.releaseManifest, (row) => ({ OR: [{ id: row.id }, { releaseVersion: row.releaseVersion }] }));
  await restore("clientVersionPolicies", client.clientVersionPolicy, (row) => ({ OR: [{ id: row.id }, { environment: row.environment }] }));
  return result;
}

function validateRow(key: TechnicalOperationsBackupKey, value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`technicalOperations.${key}[${index}] must be an object`);
  const unknown = Object.keys(value).filter((field) => !ALLOWED_KEYS[key].has(field));
  if (unknown.length) throw new Error(`technicalOperations.${key}[${index}] contains unsupported fields`);
  if (Object.keys(value).some((field) => /password|secret|credential|token|absolutePath|payload/i.test(field))) {
    throw new Error(`technicalOperations.${key}[${index}] contains prohibited fields`);
  }
  return { ...value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
