import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { createMaintenanceWindow, OperationalWorkflowError, transitionOperationalAlert } from "../lib/operational-workflows";
import { createSafeOperationalLogEntry, safeErrorFingerprint, stringifySafeOperationalLog } from "../lib/safe-logging";
import { emptyTechnicalOperationsBackup, restoreTechnicalOperationsBackup, validateTechnicalOperationsBackup } from "../lib/technical-operations-backup";
import { OPERATIONAL_DOMAINS, worstOperationalStatus } from "../lib/technical-operations-types";
import { enforceDeepCheckRateLimit } from "../lib/technical-operations-api";
import { RECOMMENDED_ROLE_PERMISSIONS } from "../lib/permissions";
import { stableOperationalFingerprint, technicalOperationsPrivateHeaders } from "../lib/technical-operations";

describe("OBS-1A technical operations contracts", () => {
  it("defines exactly thirteen independent health domains and keeps optional configuration neutral", () => {
    expect(OPERATIONAL_DOMAINS).toHaveLength(13);
    expect(new Set(OPERATIONAL_DOMAINS).size).toBe(13);
    expect(worstOperationalStatus(["HEALTHY", "NOT_CONFIGURED"])).toBe("HEALTHY");
    expect(worstOperationalStatus(["HEALTHY", "WARNING", "DEGRADED"])).toBe("WARNING");
    expect(worstOperationalStatus(["HEALTHY", "DEGRADED"])).toBe("DEGRADED");
    expect(worstOperationalStatus(["HEALTHY", "CRITICAL"])).toBe("CRITICAL");
    expect(worstOperationalStatus(["UNKNOWN", "NOT_CONFIGURED"])).toBe("UNKNOWN");
    expect(worstOperationalStatus(["HEALTHY", "MAINTENANCE"])).toBe("MAINTENANCE");
  });

  it("defaults full evidence to Super Admin, summary to Director, and denies every other role", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(expect.objectContaining({ has: expect.any(Function) }));
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("VIEW_TECHNICAL_OPERATIONS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("VIEW_TECHNICAL_OPERATIONS_SUMMARY")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("VIEW_TECHNICAL_OPERATIONS")).toBe(false);
    for (const role of ["PRINCIPAL", "ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("VIEW_TECHNICAL_OPERATIONS_SUMMARY")).toBe(false);
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("VIEW_TECHNICAL_OPERATIONS")).toBe(false);
    }
  });

  it("rate limits repeated deep checks per actor without sharing identity data", () => {
    const actor = `OBS1AQA-rate-${Date.now()}`;
    enforceDeepCheckRateLimit(actor, 1_000);
    enforceDeepCheckRateLimit(actor, 2_000);
    expect(() => enforceDeepCheckRateLimit(actor, 3_000)).toThrow("TECHNICAL_CHECK_RATE_LIMITED");
    expect(() => enforceDeepCheckRateLimit(`${actor}-other`, 3_000)).not.toThrow();
  });

  it("emits private no-store headers and stable deduplication fingerprints", () => {
    expect(technicalOperationsPrivateHeaders()).toMatchObject({ "Cache-Control": expect.stringContaining("no-store"), Vary: "Cookie" });
    expect(stableOperationalFingerprint(["DATABASE_HEALTH", "database.integrity"])).toBe(stableOperationalFingerprint([" database_health ", "DATABASE.INTEGRITY"]));
  });

  it("removes secret-shaped, PII-shaped, path and network values from structured logs", () => {
    const serialized = stringifySafeOperationalLog({
      level: "ERROR",
      eventName: "provider.failed",
      correlationId: "safe-correlation-123",
      component: "notification-worker",
      error: new Error("Bearer abcdefghijklmnopqrstuvwxyz at C:\\private\\school.db for admin@example.com 10.1.2.3"),
      metadata: {
        password: "NeverPersistThis",
        guardianMobile: "+91 9876543210",
        absolutePath: "C:\\private\\student.pdf",
        safeCount: 4,
        safeState: "failed for admin@example.com at /home/private/file.pdf"
      },
      now: new Date("2026-08-10T00:00:00.000Z")
    });
    expect(serialized).not.toMatch(/NeverPersistThis|9876543210|student\.pdf|admin@example\.com|10\.1\.2\.3|Bearer|school\.db|\/home\/private/i);
    expect(JSON.parse(serialized).metadata).toEqual({ safeCount: 4, safeState: "failed for [REDACTED] at [REDACTED]" });
    expect(safeErrorFingerprint(new Error("same private 9876543210"), "worker")).toHaveLength(20);
    expect(createSafeOperationalLogEntry({ level: "INFO", eventName: "ok", component: "core" }).errorFingerprint).toBeNull();
  });

  it("backs up durable technical configuration/history at v40 and excludes high-volume artifacts", () => {
    const technicalOperations = emptyTechnicalOperationsBackup();
    technicalOperations.operationalCheckDefinitions.push({ id: "check-1", checkKey: "database.integrity", name: "Database integrity", domain: "DATABASE_HEALTH", checkType: "DEEP", cadence: "MANUAL", enabled: true, protectedCritical: true, severityOnFailure: "CRITICAL", descriptionSafe: "Bounded integrity check", runbookPath: "/docs/runbooks/OBS_CORE_DATABASE_RUNBOOK.md", retentionDays: 90, createdAt: new Date(), updatedAt: new Date() });
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-10T00:00:00.000Z"), generatedBy: "OBS1A", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], technicalOperations });
    expect(backup.metadata.backupVersion).toBe(40);
    expect(backup.metadata.counts.technicalOperationsRecords).toBe(1);
    expect(backup.technicalOperations.operationalCheckDefinitions).toHaveLength(1);
    expect(backup).not.toHaveProperty("operationalCheckRuns");
    expect(backup).not.toHaveProperty("operationalMetricSnapshots");
    expect(backup).not.toHaveProperty("backgroundJobRuns");
  });

  it("fails closed on unsupported or secret-bearing technical backup fields", () => {
    expect(() => validateTechnicalOperationsBackup({ operationalAlerts: [{ id: "a", password: "bad" }] })).toThrow(/unsupported fields|prohibited fields/);
    expect(() => validateTechnicalOperationsBackup({ operationalAlerts: [], unknownRows: [] })).toThrow(/unsupported fields/);
  });

  it("refuses protected alert silence, stale alert updates, and protected maintenance suppression", async () => {
    const protectedAlert = { id: "a", publicKey: "alert-key", checkKey: "database.integrity", severity: "CRITICAL", status: "OPEN", version: 2, occurrenceCount: 1 };
    const client = { operationalAlert: { findUnique: async () => protectedAlert } };
    await expect(transitionOperationalAlert(client as never, "alert-key", { action: "SILENCE", expectedVersion: 2, reason: "Planned maintenance review", silencedUntil: "2026-08-11T00:00:00.000Z" }, "user", new Date("2026-08-10T00:00:00.000Z"))).rejects.toMatchObject({ code: "PROTECTED_ALERT" });
    await expect(transitionOperationalAlert(client as never, "alert-key", { action: "ACKNOWLEDGE", expectedVersion: 1 }, "user")).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(createMaintenanceWindow({} as never, { domain: "DATABASE_HEALTH", checkKeys: ["database.integrity"], reason: "Planned maintenance", expectedImpact: "No expected impact", plannedStartAt: "2026-08-11T00:00:00.000Z", plannedEndAt: "2026-08-11T01:00:00.000Z" }, "user", new Date("2026-08-10T00:00:00.000Z"))).rejects.toBeInstanceOf(OperationalWorkflowError);
  });

  it("restores durable records twice without duplication", async () => {
    const backup = emptyTechnicalOperationsBackup();
    backup.operationalCheckDefinitions.push({ id: "check-1", checkKey: "database.integrity" });
    const rows = new Map<string, Record<string, unknown>>();
    const delegate = {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.has(String((where.OR as Array<Record<string, unknown>> | undefined)?.[0]?.id ?? where.id)) ? { id: "check-1" } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => { rows.set(String(data.id), data); return data; }
    };
    const emptyDelegate = { findFirst: async () => null, create: async () => ({}) };
    const client = { operationalCheckDefinition: delegate, operationalAlert: emptyDelegate, operationalAlertEvent: emptyDelegate, operationalIncident: emptyDelegate, operationalIncidentEvent: emptyDelegate, maintenanceWindow: emptyDelegate, maintenanceWindowEvent: emptyDelegate, releaseManifest: emptyDelegate, clientVersionPolicy: emptyDelegate };
    const first = await restoreTechnicalOperationsBackup(client as never, backup);
    const second = await restoreTechnicalOperationsBackup(client as never, backup);
    expect(first).toMatchObject({ created: 1, skipped: 0, errors: [] });
    expect(second).toMatchObject({ created: 0, skipped: 1, errors: [] });
    expect(rows.size).toBe(1);
  });
});
