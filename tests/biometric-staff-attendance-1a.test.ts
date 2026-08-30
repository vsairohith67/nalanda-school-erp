import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { emptyBiometricAttendanceBackup, validateBiometricAttendanceBackupRows } from "@/lib/biometric-attendance/backup";
import { biometricEventIdentity, stableJson, validateBiometricEnvelope } from "@/lib/biometric-attendance/contracts";
import { biometricAttendanceAvailability } from "@/lib/biometric-attendance/feature-flag";
import { assertProtocolActivation, BIOMETRIC_PROTOCOL_PROFILES, protocolProfileStatus } from "@/lib/biometric-attendance/profiles";
import { can, RECOMMENDED_ROLE_PERMISSIONS, type Role } from "@/lib/permissions";
import { visibleNavigationItems } from "@/lib/access-rules";
import { requestBodyLimitBytes } from "@/lib/request-security";
import { operationPolicy } from "@/lib/security-resilience";
import { BIOMETRIC_PRIVATE_HEADERS } from "@/lib/biometric-attendance/api";
import { defaultPermissionMatrix } from "@/lib/role-permissions";
import { permissionCanAppearInProfile } from "@/lib/iam/permission-governance";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");
const now = new Date("2026-08-28T12:00:00.000Z");
const deviceId = "00000000-0000-4000-8000-000000000001";
const event = { deviceId, opaqueDeviceUserId: "STAFF-001", punchTimestamp: "2026-08-28T02:30:00.000Z", bridgeReceivedTimestamp: "2026-08-28T02:30:01.000Z", estimatedClockDriftSeconds: 0, verificationMethod: "FINGERPRINT", punchCode: "IN", statusCode: null, sequenceNumber: 1, sequenceEpoch: 1, eventReference: "SIM-1", protocolProfile: "SIMULATOR" };

afterEach(() => { delete process.env.RELEASE_FEATURE_FLAGS_QA_MODE; delete process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED; });

describe("BIOMETRIC-STAFF-ATTENDANCE-1A", () => {
  it("gives signed bridge ingestion a bounded high-cost edge policy", () => {
    expect(requestBodyLimitBytes("/api/biometric/ingest")).toBe(256 * 1024);
    expect(operationPolicy("/api/biometric/ingest", "POST")).toMatchObject({ id: "biometric.ingest", cost: "HIGH", maximum: 60 });
  });

  it("is production default-off at zero rollout and hides all navigation", () => {
    expect(biometricAttendanceAvailability()).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    const flags = JSON.parse(source("config/release-feature-flags.json"));
    expect(flags.find((flag: { key: string }) => flag.key === "biometric-staff-attendance-1a")).toMatchObject({ defaultState: false, rolloutPercentage: 0, allowedRoles: ["SUPER_ADMIN"] });
    expect(visibleNavigationItems(["VIEW_BIOMETRIC_ATTENDANCE"], "SUPER_ADMIN").some((item) => item.href.includes("biometric"))).toBe(false);
    expect(visibleNavigationItems(["VIEW_OWN_STAFF_ATTENDANCE"], "TEACHER").some((item) => item.href === "/teacher/attendance")).toBe(false);
  });

  it("enforces the requested role boundary and explicit dual-control permissions", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("MANAGE_BIOMETRIC_DEVICES")).toBe(true);
    expect(permissionCanAppearInProfile("MANAGE_BIOMETRIC_DEVICES")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("APPROVE_BIOMETRIC_ATTENDANCE")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("VIEW_OWN_STAFF_ATTENDANCE")).toBe(true);
    for (const role of ["ADMIN", "ACCOUNTANT", "COMPUTER_OPERATOR", "GATE_STAFF", "PARENT", "STUDENT", "VIEWER"] as Role[]) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("VIEW_BIOMETRIC_ATTENDANCE"), role).toBe(false);
      expect(defaultPermissionMatrix()[role].MANAGE_BIOMETRIC_DEVICES, role).toBe(false);
    }
    expect(can("MARKS_ENTRY_OPERATOR" as Role, "VIEW_BIOMETRIC_ATTENDANCE")).toBe(false);
  });

  it("accepts only the normalized provider-neutral event contract", () => {
    const envelope = validateBiometricEnvelope({ schemaVersion: 1, batchReference: "batch-0001", bridgeTime: now.toISOString(), events: [event] }, now);
    expect(envelope.events).toHaveLength(1);
    expect(stableJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
    expect(biometricEventIdentity(envelope.events[0])).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validateBiometricEnvelope({ schemaVersion: 1, batchReference: "batch-0001", bridgeTime: now.toISOString(), events: [{ ...event, fingerprintTemplate: "forbidden" }] }, now)).toThrow("BIOMETRIC_SECRET_OR_TEMPLATE_FIELD_FORBIDDEN");
    expect(() => validateBiometricEnvelope({ schemaVersion: 1, batchReference: "batch-0001", bridgeTime: now.toISOString(), events: Array.from({ length: 101 }, () => event) }, now)).toThrow("BIOMETRIC_BATCH_SIZE_INVALID");
  });

  it("keeps all vendor profiles fail-closed without official documentation", () => {
    expect(BIOMETRIC_PROTOCOL_PROFILES).toEqual(["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH", "GENERIC_ADMS_PUSH", "GENERIC_LAN_POLL", "GENERIC_CSV_IMPORT", "SIMULATOR"]);
    for (const profile of ["ESSL_K30_PRO_PUSH", "ESSL_ZK_LAN_SDK", "ZK_ADMS_PUSH"] as const) {
      expect(() => assertProtocolActivation(profile, "NOT_PROVIDED")).toThrow("BIOMETRIC_VENDOR_PROTOCOL_NOT_VERIFIED");
      expect(protocolProfileStatus(profile)).toMatchObject({ ingestionAllowed: false, hardwareCertified: false });
    }
    expect(() => assertProtocolActivation("GENERIC_ADMS_PUSH", "ADAPTER_CONTRACT_PENDING")).toThrow("BIOMETRIC_GENERIC_ADAPTER_CONTRACT_NOT_APPROVED");
    expect(protocolProfileStatus("GENERIC_LAN_POLL", "ADAPTER_CONTRACT_PENDING").ingestionAllowed).toBe(false);
    expect(() => assertProtocolActivation("SIMULATOR", "NOT_PROVIDED")).not.toThrow();
  });

  it("ships immutable raw evidence, correction evidence, replay, transition and mapping guards", () => {
    for (const migration of ["prisma/migrations/20260828090000_biometric_staff_attendance_1a/migration.sql", "prisma/postgresql/migrations/20260828090000_biometric_staff_attendance_1a/migration.sql"]) {
      const sql = source(migration);
      expect(sql).toContain("BIOMETRIC_RAW_EVIDENCE_IMMUTABLE");
      expect(sql).toContain("BIOMETRIC_CORRECTION_EVIDENCE_IMMUTABLE");
      expect(sql).toContain("BiometricReplayNonce");
      expect(sql).toContain("BiometricStaffMapping");
      expect(sql).toContain("BiometricDevice");
      expect(sql).toContain("BIOMETRIC_DEVICE_TRANSITION_INVALID");
    }
  });

  it("backs up immutable evidence but excludes ephemeral replay and all protected material", () => {
    const empty = emptyBiometricAttendanceBackup();
    expect(validateBiometricAttendanceBackupRows(empty)).toEqual(empty);
    expect(Object.keys(empty)).not.toContain("biometricReplayNonces");
    expect(JSON.stringify(empty)).not.toMatch(/fingerprintTemplate|facialTemplate|fingerprintImage|facialImage|cardSecret|administratorPassword/);
    expect(source("lib/backup.ts")).toContain("...biometricAttendanceBackup");
    expect(source("lib/restore-database.ts")).toContain("restoreBiometricAttendanceBackup");
    expect(() => validateBiometricAttendanceBackupRows({
      ...empty,
      biometricBridges: [{
        id: "bridge-private-key", publicBridgeId: "bridge-public-key", label: "Unsafe bridge",
        publicSigningKey: JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "public", d: "private" }),
        publicKeyHash: "0".repeat(64), keyAlgorithm: "ED25519", keyVersion: 1,
        status: "PENDING_APPROVAL", createdAt: now.toISOString(), updatedAt: now.toISOString()
      }]
    })).toThrow("BIOMETRIC_BRIDGE_PUBLIC_KEY_INVALID");
  });

  it("keeps devices off the public internet and attendance outside payroll", () => {
    const bridgeConfig = source("apps/nalanda-biometric-bridge/src/config.ts");
    expect(bridgeConfig).toContain("privateLanHost");
    expect(bridgeConfig).not.toMatch(/scan|discovery|broadcast/i);
    expect(source("apps/nalanda-biometric-bridge/src/health.ts")).not.toMatch(/listen\(|createServer|express|fastify/i);
    expect(source("lib/biometric-attendance/reconciliation.ts")).toContain("payrollImpact: false");
    expect(source("lib/biometric-attendance/reconciliation.ts")).not.toMatch(/salary|payrollRun|payslip/i);
  });

  it("keeps biometric evidence out of Universal Search and Smart AI", () => {
    const separated = ["lib/universal-search.ts", "lib/universal-search-contract.ts", "lib/smart-ai.ts", "lib/smart-ai-contract.ts", "lib/ai-assistant-tools.ts"].map(source).join("\n");
    expect(separated).not.toMatch(/biometricRawPunch|biometricReconciliation|biometricCorrection|MANAGE_BIOMETRIC|APPROVE_BIOMETRIC/i);
  });

  it("bounds and hardens exports and separates software from hardware certification", () => {
    const exportRoute = source("app/api/attendance/staff/biometric/reports/export/route.ts");
    expect(exportRoute).toContain("BIOMETRIC_PRIVATE_HEADERS");
    expect(BIOMETRIC_PRIVATE_HEADERS["Cache-Control"]).toBe("private, no-store, max-age=0");
    expect(source("lib/biometric-attendance/reconciliation.ts")).toContain("formulaSafe");
    expect(source("apps/nalanda-biometric-bridge/src/adapters/vendor-disabled.ts")).toContain("VENDOR_PROTOCOL_NOT_VERIFIED");
  });
});
