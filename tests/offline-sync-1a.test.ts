import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateOfflineSyncBatch, stableJson } from "@/lib/offline-sync/contracts";
import { challengeMessage, normalizePublicJwk, publicJwkHash, requestProofMessage, verifyEcdsaSignature } from "@/lib/offline-sync/device-trust";
import { offlineSyncAvailability, offlineSyncRoleAllowed } from "@/lib/offline-sync/feature-flag";
import { RECOMMENDED_ROLE_PERMISSIONS, type Role } from "@/lib/permissions";
import { immutablePermissionDenial } from "@/lib/iam/permission-governance";
import { requestBodyLimitBytes } from "@/lib/request-security";
import { operationPolicy } from "@/lib/security-resilience";
import { visibleNavigationItems } from "@/lib/access-rules";
import { buildServiceWorkerSource } from "@/lib/pwa-service-worker";
import { emptyOfflineSyncBackup, validateOfflineSyncBackupRows } from "@/lib/offline-sync/backup";
import { createBackupDocument } from "@/lib/backup";
import { canonicalOfflineRequestTarget } from "@/lib/offline-sync/request-target";
import { selectOfflineMiscRate } from "@/lib/offline-sync/rate-intent";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");
afterEach(() => { delete process.env.RELEASE_FEATURE_FLAGS_QA_MODE; delete process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED; delete process.env.DATABASE_URL; delete process.env.APP_ORIGIN; });

describe("OFFLINE-SYNC-1A contracts", () => {
  it("is production default-off and role fail-closed", () => {
    expect(offlineSyncAvailability()).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    expect(offlineSyncRoleAllowed("ACCOUNTANT")).toBe(true); expect(offlineSyncRoleAllowed("SUPER_ADMIN")).toBe(true);
    for (const role of ["DIRECTOR","PRINCIPAL","ADMIN","COMPUTER_OPERATOR","TEACHER","PARENT","STUDENT","VIEWER","GATE_STAFF","MARKS_ENTRY_OPERATOR"]) expect(offlineSyncRoleAllowed(role), role).toBe(false);
  });

  it("uses the explicit permission matrix and immutable denials", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT.has("USE_OFFLINE_SYNC")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("MANAGE_OFFLINE_SYNC_DEVICES")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("REVIEW_OFFLINE_SYNC_CONFLICTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("REVIEW_OFFLINE_SYNC_CONFLICTS")).toBe(true);
    for (const role of ["ADMIN","COMPUTER_OPERATOR","TEACHER","PARENT","STUDENT","VIEWER","GATE_STAFF"] as Role[]) expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("USE_OFFLINE_SYNC"), role).toBe(false);
    expect(immutablePermissionDenial("ACCOUNTANT", "MANAGE_OFFLINE_SYNC_DEVICES")).toMatch(/Super Admin/);
    expect(immutablePermissionDenial("COMPUTER_OPERATOR", "USE_OFFLINE_SYNC")).toBeTruthy();
  });

  it("hides navigation until the governed feature is enabled", () => {
    expect(visibleNavigationItems(["USE_OFFLINE_SYNC"], "ACCOUNTANT").some((item) => item.href === "/offline/finance")).toBe(false);
    expect(visibleNavigationItems(["USE_OFFLINE_SYNC"], "ACCOUNTANT", ["OFFLINE_SYNC_1A"]).some((item) => item.href === "/offline/finance")).toBe(true);
    expect(visibleNavigationItems(["USE_OFFLINE_SYNC"], "ADMIN", ["OFFLINE_SYNC_1A"]).some((item) => item.href === "/offline/finance")).toBe(false);
    expect(visibleNavigationItems(["REVIEW_OFFLINE_SYNC_CONFLICTS"], "DIRECTOR", ["OFFLINE_SYNC_1A"]).some((item) => item.href === "/offline/conflicts")).toBe(true);
    expect(visibleNavigationItems(["MANAGE_OFFLINE_SYNC_DEVICES"], "DIRECTOR", ["OFFLINE_SYNC_1A"]).some((item) => item.href === "/offline/devices")).toBe(false);
  });

  it("canonicalizes payloads and bounds batches to 25 supported drafts", async () => {
    expect(stableJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
    const payload = { admissionNo: "A1", amountPaid: "100" };
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(payload))))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const mutation = { clientMutationId: "mutation-123456", localDraftId: "draft-12345678", operationType: "FEE_PAYMENT", payload, payloadHash: hash, createdClientAt: new Date().toISOString(), referenceSnapshotVersion: `${"a".repeat(16)}.${"b".repeat(32)}`, baseEntityVersion: new Date().toISOString() };
    expect(validateOfflineSyncBatch({ schemaVersion: 1, mutations: [mutation] }).mutations).toHaveLength(1);
    expect(() => validateOfflineSyncBatch({ schemaVersion: 1, mutations: Array.from({ length: 26 }, (_, index) => ({ ...mutation, clientMutationId: `mutation-${String(index).padStart(8,"0")}` })) })).toThrow("SYNC_BATCH_SIZE_INVALID");
    expect(() => validateOfflineSyncBatch({ schemaVersion: 1, mutations: [{ ...mutation, operationType: "MARKS" }] })).toThrow("OPERATION_NOT_ALLOWED");
  });

  it("verifies a non-extractable-compatible P-256 proof and detects tampering", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const jwk = normalizePublicJwk(await crypto.subtle.exportKey("jwk", pair.publicKey)); const hash = publicJwkHash(jwk);
    const message = challengeMessage({ challenge: "challenge", publicDeviceId: "00000000-0000-4000-8000-000000000001", keyVersion: 1, publicKeyHash: hash });
    const signature = Buffer.from(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(message))).toString("base64url");
    expect(await verifyEcdsaSignature(JSON.stringify(jwk), message, signature)).toBe(true);
    expect(await verifyEcdsaSignature(JSON.stringify(jwk), `${message}tampered`, signature)).toBe(false);
    expect(() => normalizePublicJwk({ ...jwk, d: "private-material" })).toThrow("PUBLIC_KEY_INVALID");
  });

  it("binds request proofs to method, path, time, nonce, body, device, key and schema", () => {
    const target = canonicalOfflineRequestTarget("/api/offline-sync/reference-pack?cursor=one%2Ftwo&cursor=three");
    const value = requestProofMessage({ method: "post", path: target, timestamp: "1", nonce: "nonce", bodyHash: "hash", publicDeviceId: "device", keyVersion: 2, schemaVersion: 1 });
    expect(value.split("\n")).toEqual(["offline-sync-request-v1","POST","/api/offline-sync/reference-pack?cursor=one%2Ftwo&cursor=three","1","nonce","hash","device","2","1"]);
    expect(source("lib/offline-sync/client/device.ts")).toContain("canonicalOfflineRequestTarget(path)");
    expect(source("lib/offline-sync/device-trust.ts")).toContain("canonicalOfflineRequestTarget(new URL(input.request.url))");
  });

  it("binds miscellaneous-income drafts to the exactly applicable cached rate", () => {
    const rates = [
      { id: "old", academicYear: "2026-27", effectiveFrom: "2026-04-01T00:00:00.000Z", effectiveTo: "2026-06-30T00:00:00.000Z", entityVersion: "2026-04-01T00:00:00.000Z" },
      { id: "current", academicYear: "2026-27", effectiveFrom: "2026-07-01T00:00:00.000Z", effectiveTo: null, entityVersion: "2026-07-01T00:00:00.000Z" }
    ];
    expect(selectOfflineMiscRate(rates, "2026-27", "2026-07-15").id).toBe("current");
    expect(() => selectOfflineMiscRate([...rates, { ...rates[1], id: "overlap" }], "2026-27", "2026-07-15")).toThrow("exactly one approved rate");
  });

  it("applies a 512 KiB body limit and a dedicated high-cost rate policy", () => {
    expect(requestBodyLimitBytes("/api/offline-sync/sync")).toBe(512 * 1024);
    expect(operationPolicy("/api/offline-sync/sync", "POST")).toMatchObject({ id: "offline-sync", cost: "HIGH", maximum: 60 });
  });

  it("does not trust an unverified device header as a pre-authentication rate-limit actor", () => {
    const middleware = source("middleware.ts");
    const rateLimitBlock = middleware.slice(middleware.indexOf("const rateLimit"), middleware.indexOf("if (!rateLimit.allowed)"));
    expect(rateLimitBlock).not.toContain("x-offline-device-id");
    expect(rateLimitBlock).toContain('["ip", "session", "endpoint", "operationCost"]');
  });

  it("uses per-item transactions, immutable idempotency and authoritative services", () => {
    const sync = source("lib/offline-sync/sync-service.ts");
    expect(sync).toContain("deviceId_clientMutationId"); expect(sync).toContain("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
    expect(sync).toContain("prisma.$transaction"); expect(sync).toContain("evaluateEffectivePermission"); expect(sync).toContain("verifyReferenceSnapshot");
    expect(sync).toContain("createPaymentReceiptInTransaction"); expect(sync).toContain("createExpenseDraftInTransaction"); expect(sync).toContain("createMiscReceiptInTransaction");
    expect(sync).not.toMatch(/tx\.payment\.create|tx\.expenseRecord\.create|tx\.miscIncomeReceipt\.create/);
  });

  it("keeps conflict review scoped to conflict rows", () => {
    const route = source("app/api/offline-sync/conflicts/route.ts");
    expect(route).toContain('where: { status: "CONFLICT" }');
    expect(route).not.toMatch(/searchParams|const status/);
  });

  it("identifies the owning Accountant during device approval without expanding self responses", () => {
    const route = source("app/api/offline-sync/devices/route.ts");
    const governance = source("components/offline-sync/offline-device-governance.tsx");
    expect(route).toContain('user: { select: { name: true, role: true } }');
    expect(route).toContain('all ? { ...safeDevice(device), owner: device.user } : safeDevice(device)');
    expect(governance).toContain("Confirm the named Accountant and physical device");
  });

  it("bounds durable device challenges to their active proof window", () => {
    const trust = source("lib/offline-sync/device-trust.ts");
    expect(trust.match(/offlineSyncChallenge\.deleteMany\(\{ where: \{ expiresAt: \{ lte:/g)).toHaveLength(2);
    expect(trust).toContain("expiresAt: expiresAt.toISOString()");
  });

  it("rejects unsupported offline historical dues while preserving online payment behavior", () => {
    const references = source("lib/offline-sync/reference-packs.ts");
    const payments = source("lib/payment-service.ts");
    const sync = source("lib/offline-sync/sync-service.ts");
    const onlineRoute = source("app/api/payments/route.ts");
    expect(references).toContain('feeTypes: ["Current Year Fee"]');
    expect(references).not.toContain('feeTypes: ["Current Year Fee", "Old Due"]');
    expect(payments).toContain('throw new Error("FEE_TYPE_NOT_SUPPORTED_OFFLINE")');
    expect(sync).toContain("requireCurrentYearFee: true");
    expect(onlineRoute).not.toContain("requireCurrentYearFee");
  });

  it("removes deactivated reference rows during incremental refresh", () => {
    expect(source("lib/offline-sync/reference-packs.ts")).toContain("tombstones:");
    expect(source("lib/offline-sync/client/workflow.ts")).toContain("next.tombstones?.students");
  });

  it("keeps sensitive browser records encrypted and private keys non-exportable", () => {
    const cryptoSource = source("lib/offline-sync/client/crypto.ts"); const deviceSource = source("lib/offline-sync/client/device.ts");
    expect(cryptoSource).toContain("310_000"); expect(cryptoSource).toContain('name: "AES-GCM"'); expect(cryptoSource).toContain("additionalData");
    expect(deviceSource).toContain('namedCurve: "P-256"'); expect(deviceSource).toContain("}, false, [\"sign\", \"verify\"])");
    expect(cryptoSource).not.toMatch(/localStorage|sessionStorage/); expect(source("lib/offline-sync/client/database.ts")).not.toMatch(/studentName|admissionNo|payerName|description/);
    for (const file of ["components/offline-sync/offline-finance-workspace.tsx", "components/offline-sync/offline-device-governance.tsx", "components/offline-sync/offline-conflict-review.tsx"]) {
      expect(source(file), file).not.toMatch(/window\.(?:confirm|prompt)|(?<![A-Za-z])confirm\(/);
      expect(source(file), file).toContain('aria-modal="true"');
    }
  });

  it("locks offline keys and decrypted workspace state across tabs", () => {
    const coordinator = source("lib/offline-sync/client/coordinator.ts");
    expect(coordinator).toContain('type: "VAULT_LOCK"');
    expect(coordinator).toContain("lockOfflineVault()");
    expect(coordinator).toContain('window.addEventListener("storage"');
    expect(coordinator).toContain("VAULT_LOCK_STORAGE_KEY");
    expect(source("components/pwa-runtime.tsx")).toContain("installOfflineVaultLockListener");
    expect(source("components/user-menu.tsx")).toContain('lockOfflineVaultAcrossTabs("LOGOUT")');
    expect(source("components/iam/active-context-switcher.tsx")).toContain('lockOfflineVaultAcrossTabs("CONTEXT_SWITCH")');
    const workspace = source("components/offline-sync/offline-finance-workspace.tsx");
    expect(workspace).toContain("onOfflineVaultLocked");
    expect(workspace).toContain("setReferences(null); setDrafts([])");
  });

  it("keeps inactive-student rejection scoped to offline synchronization", () => {
    const paymentService = source("lib/payment-service.ts");
    const syncService = source("lib/offline-sync/sync-service.ts");
    const onlineRoute = source("app/api/payments/route.ts");
    expect(paymentService).toContain("options.requireActiveStudent && student.status.toLowerCase()");
    expect(syncService).toContain("requireActiveStudent: true");
    expect(onlineRoute).not.toContain("requireActiveStudent");
  });

  it("preserves bounded retention and keeps retryable drafts queued", () => {
    const workflow = source("lib/offline-sync/client/workflow.ts");
    expect(workflow).toContain("OFFLINE_QUEUED_RETENTION_MS");
    expect(workflow).toContain('outcome.outcome === "RETRY_LATER" ? "QUEUED"');
    expect(workflow).toContain("expiresAt: draftRow.expiresAt ?? expiresAt");
    expect(workflow).toContain("!Number.isFinite(row.expiresAt)");
  });

  it("pre-caches only the dedicated shell and never caches APIs or private HTML", () => {
    const worker = buildServiceWorkerSource();
    expect(worker).toContain('"/offline/finance"'); expect(worker).toContain('url.pathname.startsWith("/api/")'); expect(worker).toContain("OFFLINE_FINANCE_PATH");
    expect(worker).toContain('boundary !== "offline-public-shell"'); expect(worker).toContain('cacheControl.includes("no-store")');
    expect(worker).not.toMatch(/addEventListener\(["'](?:sync|periodicsync|push)/i);
  });

  it("isolates a cacheable offline shell before private layout data is resolved", () => {
    const middleware = source("middleware.ts");
    const layout = source("app/layout.tsx");
    expect(middleware).toContain('const offlinePublicShellPaths = new Set(["/offline", "/offline/finance"])');
    expect(middleware).toContain('requestHeaders.set("x-nalanda-offline-shell", "1")');
    expect(middleware).toContain('response.headers.set("x-nalanda-route-boundary", "offline-public-shell")');
    expect(middleware).toContain('response.headers.set("cache-control", "public, max-age=0, must-revalidate")');
    const publicShell = layout.indexOf('requestHeaders.get("x-nalanda-offline-shell")');
    const privateData = layout.indexOf("getCurrentUser(), getSchoolSettings(prisma)");
    expect(publicShell).toBeGreaterThan(-1);
    expect(publicShell).toBeLessThan(privateData);
    expect(layout.slice(publicShell, privateData)).not.toMatch(/getCurrentUser|getSchoolSettings|effectivePermissions|getSystemHealth|<AppShell/);
  });

  it("backs up only durable public-device and safe ledger state in the current format", () => {
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-25T00:00:00Z"), generatedBy: "QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...emptyOfflineSyncBackup() });
    expect(backup.metadata.backupVersion).toBe(45); expect(backup).toMatchObject({ offlineSyncDevices: [], offlineSyncMutations: [], offlineSyncEvents: [], offlineSyncConflictReviews: [] });
    expect(JSON.stringify(backup)).not.toMatch(/offlineSyncChallenges|offlineSyncNonces|wrappedKey|privateKey|offlinePin/i);
    expect(() => validateOfflineSyncBackupRows({ ...emptyOfflineSyncBackup(), offlineSyncDevices: [{ id: "d", publicDeviceId: "p", userId: "u", label: "x", platform: "x", publicSigningKey: "{}", publicKeyHash: "bad", keyVersion: 1, status: "ACTIVE", requestedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] })).toThrow(/publicKeyHash/);
  });

  it("ships additive constraints for replay, status and append-only evidence", () => {
    const migration = source("prisma/migrations/20260825090000_offline_sync_1a/migration.sql");
    expect(migration).toContain('UNIQUE INDEX "OfflineSyncMutation_deviceId_clientMutationId_key"');
    expect(migration).toContain("OFFLINE_DEVICE_TRANSITION_INVALID"); expect(migration).toContain("OFFLINE_MUTATION_TERMINAL_IMMUTABLE"); expect(migration).toContain("OFFLINE_EVENT_IMMUTABLE");
  });
});
