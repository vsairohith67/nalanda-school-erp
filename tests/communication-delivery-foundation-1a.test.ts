import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_PURPOSES,
  OUTBOX_STATES,
  canApplyProviderState,
  isLegalOutboxTransition
} from "@/lib/communication-types";
import {
  communicationFeatureAvailability,
  communicationRoleCapabilities,
  isQuietHours,
  purposeDeliveryPolicy,
  safeDestinationDigest,
  safeMetricDimensions,
  validateActionPath,
  validateAudienceSize,
  validateEmergencyOverride
} from "@/lib/communication-policy";
import {
  COMMUNICATION_LOCALES,
  COMMUNICATION_TEMPLATE_CATALOGUE,
  communicationTemplateInventory,
  renderCommunicationTemplate,
  resolveCommunicationTemplate
} from "@/lib/communication-templates";
import {
  DisabledCommunicationAdapter,
  LocalSyntheticCommunicationSink,
  assertSyntheticDestination,
  createCommunicationAdapter,
  signSyntheticCommunicationWebhook
} from "@/lib/communication-adapters";
import { processCommunicationWebhook } from "@/lib/communication-webhooks";
import { recheckDispatchDestination, resolveCommunicationRecipients } from "@/lib/communication-recipients";
import { COMMUNICATION_BACKUP_KEYS, emptyCommunicationBackup, restoreCommunicationBackup, validateCommunicationBackupRows } from "@/lib/communication-backup";
import { createBackupDocument } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { createCommunicationIntent } from "@/lib/communication-service";
import { runWhatsAppProfileHealth } from "@/lib/whatsapp-profiles";
import { runSmsEmailProfileHealth } from "@/lib/sms-email-profiles";

const originalEnvironment = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

function enableSyntheticQa(...channels: string[]) {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: `file:${path.resolve("tmp", "communication-vitest.db").replaceAll("\\", "/")}`,
    APP_ORIGIN: "http://127.0.0.1:3000",
    RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY",
    RELEASE_FEATURE_FLAGS_QA_ENABLED: ["communication-delivery-foundation-1a", ...channels.map((value) => `communication-channel-${value.toLowerCase().replace("_", "-")}`)].join(",")
  });
}

describe("COMMUNICATION-DELIVERY-FOUNDATION-1A contracts", () => {
  it("keeps the parent and every channel fail-closed by committed default", () => {
    delete process.env.RELEASE_FEATURE_FLAGS_QA_MODE;
    delete process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED;
    expect(communicationFeatureAvailability().enabled).toBe(false);
    for (const channel of COMMUNICATION_CHANNELS) expect(communicationFeatureAvailability(channel).enabled).toBe(false);
    const flags = JSON.parse(readFileSync("config/release-feature-flags.json", "utf8"));
    const communication = flags.filter((row: any) => row.key.startsWith("communication-"));
    expect(communication).toHaveLength(6);
    expect(communication.every((row: any) => row.defaultState === false && row.rolloutPercentage === 0)).toBe(true);
  });

  it("permits only explicitly named channels in isolated copied-database QA", () => {
    enableSyntheticQa("email");
    expect(communicationFeatureAvailability().enabled).toBe(true);
    expect(communicationFeatureAvailability("EMAIL").enabled).toBe(true);
    expect(communicationFeatureAvailability("SMS").enabled).toBe(false);
  });

  it("defines the governed channel, purpose, and outbox catalogues", () => {
    expect(COMMUNICATION_CHANNELS).toEqual(["IN_APP", "EMAIL", "SMS", "WHATSAPP", "NATIVE_PUSH"]);
    expect(COMMUNICATION_PURPOSES).toContain("MARKETING_PROHIBITED_OR_SEPARATELY_GOVERNED");
    expect(OUTBOX_STATES).toContain("DEAD_LETTER");
    expect(purposeDeliveryPolicy("MARKETING_PROHIBITED_OR_SEPARATELY_GOVERNED").allowed).toBe(false);
    expect(purposeDeliveryPolicy("INFORMATIONAL_OPTIONAL").consentRequired).toBe(true);
    expect(purposeDeliveryPolicy("SECURITY_CRITICAL").consentRequired).toBe(false);
  });

  it("enforces legal and monotonic delivery transitions", () => {
    expect(isLegalOutboxTransition("QUEUED", "CLAIMED")).toBe(true);
    expect(isLegalOutboxTransition("DELIVERED", "SENT")).toBe(false);
    expect(canApplyProviderState("SENT", "DELIVERED")).toBe(true);
    expect(canApplyProviderState("DELIVERED", "SENT")).toBe(false);
    expect(canApplyProviderState("SUPPRESSED", "DELIVERED")).toBe(false);
  });

  it("rejects open redirects, control characters, and unsafe metrics", () => {
    expect(validateActionPath("/parent/report-cards?source=notice")).toBe("/parent/report-cards?source=notice");
    for (const value of ["https://evil.invalid/", "//evil.invalid", "javascript:alert(1)", "/safe\\evil", "/safe\nInjected"]) expect(() => validateActionPath(value)).toThrow("COMMUNICATION_ACTION_PATH_NOT_ALLOWED");
    expect(() => safeMetricDimensions({ destinationDigest: "secret" })).toThrow("COMMUNICATION_HIGH_CARDINALITY_METRIC_LABEL_DENIED");
    expect(safeMetricDimensions({ channel: "EMAIL", state: "QUEUED" })).toEqual({ channel: "EMAIL", state: "QUEUED" });
  });

  it("requires governed large-audience and emergency evidence", () => {
    expect(() => validateAudienceSize({ count: 201, approved: false })).toThrow("COMMUNICATION_LARGE_AUDIENCE_APPROVAL_REQUIRED");
    expect(() => validateAudienceSize({ count: 800, approved: true })).toThrow("COMMUNICATION_LARGE_AUDIENCE_APPROVAL_REQUIRED");
    expect(() => validateAudienceSize({ count: 800, approved: true, stepUpGrantId: "step-up" })).not.toThrow();
    expect(() => validateEmergencyOverride({ purpose: "TRANSACTIONAL", actorRole: "SUPER_ADMIN", reason: "Synthetic reason", stepUpGrantId: "step" })).toThrow("EMERGENCY_OVERRIDE_SAFETY_ONLY");
    expect(() => validateEmergencyOverride({ purpose: "SAFETY_CRITICAL", actorRole: "TEACHER", reason: "Synthetic reason", stepUpGrantId: "step" })).toThrow("EMERGENCY_OVERRIDE_ROLE_DENIED");
    expect(validateEmergencyOverride({ purpose: "SAFETY_CRITICAL", actorRole: "DIRECTOR", reason: "Synthetic reason", stepUpGrantId: "step" }).audited).toBe(true);
  });

  it("evaluates cross-midnight quiet hours in the configured timezone", () => {
    expect(isQuietHours({ now: new Date("2026-09-04T19:00:00.000Z"), start: "22:00", end: "06:00", timeZone: "Asia/Kolkata" })).toBe(true);
    expect(isQuietHours({ now: new Date("2026-09-04T08:00:00.000Z"), start: "22:00", end: "06:00", timeZone: "Asia/Kolkata" })).toBe(false);
  });

  it("denies arbitrary communication powers for every role", () => {
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "COMPUTER_OPERATOR", "VIEWER", "UNKNOWN_CUSTOM"]) {
      expect(communicationRoleCapabilities(role).arbitraryRecipientOrMessage).toBe(false);
      expect(communicationRoleCapabilities(role).activateLiveProvider).toBe(false);
    }
    expect(communicationRoleCapabilities("VIEWER").viewOperations).toBe(false);
    expect(communicationRoleCapabilities("UNKNOWN_CUSTOM").viewOwn).toBe(false);
  });

  it("ships immutable English plus explicitly unreviewed Telugu and Hindi template variants", () => {
    expect(COMMUNICATION_TEMPLATE_CATALOGUE.length).toBeGreaterThanOrEqual(11);
    expect(COMMUNICATION_LOCALES).toEqual(["en-IN", "te-IN", "hi-IN"]);
    const inventory = communicationTemplateInventory();
    expect(inventory.reviewedEnglish).toBe(inventory.families);
    expect(inventory.draftPendingLanguageReview).toBe(inventory.families * 2);
    for (const family of COMMUNICATION_TEMPLATE_CATALOGUE) {
      expect(family.version).toBe(1);
      expect(family.copy["en-IN"].reviewStatus).toBe("APPROVED");
      expect(family.copy["te-IN"].reviewStatus).toBe("DRAFT_PENDING_LANGUAGE_REVIEW");
      expect(family.copy["hi-IN"].reviewStatus).toBe("DRAFT_PENDING_LANGUAGE_REVIEW");
    }
  });

  it("renders channel-specific minimized content with a deterministic hash", () => {
    const input = { templateKey: "REPORT_AVAILABLE", version: 1, locale: "en-IN", channel: "EMAIL" as const, substitutions: { schoolDisplayName: "Nalanda Synthetic School" } };
    const first = renderCommunicationTemplate(input), second = renderCommunicationTemplate(input);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.body).not.toMatch(/marks|ledger|aadhaar|medical/i);
    expect(first.html).toContain("<main>");
    expect(first.html).not.toMatch(/script|iframe|tracking/i);
    expect(first.actionPath).toBe("/parent/report-cards");
    expect(resolveCommunicationTemplate({ ...input, locale: "fr-FR" }).fallbackApplied).toBe(true);
  });

  it("binds every intent to the catalogue event, purpose, and module before authorization", async () => {
    const input: any = { eventType: "REPORT_ISSUED", purpose: "TRANSACTIONAL", module: "ACADEMICS", sourceRecordType: "SYNTHETIC_REPORT", sourceRecordId: "report-1", sourceEventId: "event-1", recipientPolicy: "CURRENT_USER", recipientScope: {}, eligibleChannels: ["IN_APP"], templateKey: "REPORT_AVAILABLE", templateVersion: 1, priority: "NORMAL", deduplicationKey: "dedup-1", idempotencyKey: "intent-1", initiatingActorId: "actor-1", authorizingContext: {} };
    await expect(createCommunicationIntent({}, input, { pepper: "synthetic-pepper-value-at-least-24", authorizeIntent: async () => { throw new Error("AUTHORIZATION_MUST_NOT_RUN"); } })).rejects.toThrow("COMMUNICATION_TEMPLATE_CLASSIFICATION_MISMATCH");
  });

  it("requires a bounded server-owned source authorization receipt", async () => {
    const input: any = { eventType: "REPORT_ISSUED", purpose: "ACADEMIC_OPERATIONAL", module: "ACADEMICS", sourceRecordType: "SYNTHETIC_REPORT", sourceRecordId: "report-1", sourceEventId: "event-1", recipientPolicy: "CURRENT_USER", recipientScope: {}, eligibleChannels: ["IN_APP"], templateKey: "REPORT_AVAILABLE", templateVersion: 1, priority: "NORMAL", deduplicationKey: "dedup-1", idempotencyKey: "intent-1", initiatingActorId: "actor-1", authorizingContext: {} };
    await expect(createCommunicationIntent({}, input, { pepper: "synthetic-pepper-value-at-least-24", authorizeIntent: async () => ({ sourceRecordType: "OTHER_SOURCE", sourceRecordId: input.sourceRecordId, sourceEventId: input.sourceEventId, recipientPolicy: input.recipientPolicy, maximumAudience: 1, authorityReference: "synthetic-authority" }) })).rejects.toThrow("COMMUNICATION_SOURCE_AUTHORITY_MISMATCH");
  });

  it("blocks legacy live network health while communication flags are off", async () => {
    delete process.env.RELEASE_FEATURE_FLAGS_QA_MODE;
    delete process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED;
    const whatsAppClient = { whatsAppIntegrationProfile: { findUnique: async () => ({ id: "wa-1", mode: "LIVE" }) } };
    const smsClient = { smsEmailIntegrationProfile: { findUnique: async () => ({ id: "sms-1", mode: "LIVE", channel: "SMS" }) } };
    await expect(runWhatsAppProfileHealth(whatsAppClient, "wa-1", true)).rejects.toThrow("operationally disabled");
    await expect(runSmsEmailProfileHealth(smsClient, "sms-1", true)).rejects.toThrow("operationally disabled");
  });

  it("rejects placeholder, HTML, CRLF, and sensitive-content injection", () => {
    expect(() => renderCommunicationTemplate({ templateKey: "REPORT_AVAILABLE", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { schoolDisplayName: "<script>alert(1)</script>" } })).not.toThrow();
    const rendered = renderCommunicationTemplate({ templateKey: "REPORT_AVAILABLE", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { schoolDisplayName: "<script>alert(1)</script>" } });
    expect(rendered.html).not.toContain("<script>");
    expect(() => renderCommunicationTemplate({ templateKey: "REPORT_AVAILABLE", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { arbitrary: "value" } })).toThrow("COMMUNICATION_TEMPLATE_PLACEHOLDER_DENIED");
    expect(() => renderCommunicationTemplate({ templateKey: "ACCOUNT_INVITATION", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { schoolDisplayName: "Synthetic\r\nBcc: bad@example.invalid" } })).toThrow("COMMUNICATION_TEMPLATE_VALUE_INVALID");
  });

  it("accepts only unmistakably synthetic destinations and never exposes network capability", async () => {
    const sink = new LocalSyntheticCommunicationSink();
    expect(sink.networkCapable).toBe(false);
    expect(new DisabledCommunicationAdapter().networkCapable).toBe(false);
    expect(() => createCommunicationAdapter("TWILIO")).toThrow("COMMUNICATION_PROVIDER_NOT_SELECTED");
    expect(() => assertSyntheticDestination("EMAIL", "person@example.com")).toThrow("COMMUNICATION_SYNTHETIC_DESTINATION_REQUIRED");
    expect(() => assertSyntheticDestination("SMS", "+910000000000")).toThrow("COMMUNICATION_SYNTHETIC_DESTINATION_REQUIRED");
    expect(() => assertSyntheticDestination("EMAIL", "parent-001@example.invalid")).not.toThrow();
    expect(() => assertSyntheticDestination("NATIVE_PUSH", "synthetic:push:device-001")).not.toThrow();
    const request = { channel: "EMAIL" as const, destination: "parent-001@example.invalid", destinationDigest: "a".repeat(64), destinationMasked: "p***@example.invalid", idempotencyKey: "idempotency", contentHash: "b".repeat(64), title: "Synthetic", subject: "Synthetic", body: "Synthetic notification", actionPath: "/communication" };
    const accepted = await sink.send(request), duplicate = await sink.send(request);
    expect(accepted.providerMessageId).toBe(duplicate.providerMessageId);
    expect(sink.captured).toHaveLength(1);
    expect((await sink.send({ ...request, idempotencyKey: "timeout", simulation: "TIMEOUT_AFTER_ACCEPTANCE" })).uncertain).toBe(true);
    expect((await sink.send({ ...request, idempotencyKey: "rate", simulation: "RATE_LIMIT" })).retryAfterMs).toBe(60_000);
  });

  it("uses peppered destination digests", () => {
    const first = safeDestinationDigest("EMAIL", "parent@example.invalid", "synthetic-pepper-value-at-least-24");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("parent");
    expect(() => safeDestinationDigest("EMAIL", "parent@example.invalid", "short")).toThrow("COMMUNICATION_DESTINATION_PEPPER_REQUIRED");
  });

  it("binds external delivery to the latest verified contact point version", async () => {
    const pepper = "synthetic-pepper-value-at-least-24";
    const digest = safeDestinationDigest("EMAIL", "parent@example.invalid", pepper);
    const client = {
      guardian: { findFirst: async () => ({ email: "parent@example.invalid", primaryMobile: null }) },
      communicationContactPoint: { findFirst: async () => ({ id: "contact-2", version: 2, destinationDigest: digest, destinationMasked: "p***@example.invalid" }) }
    };
    await expect(recheckDispatchDestination(client, { channel: "EMAIL", recipientSubjectType: "GUARDIAN", recipientSubjectReferenceId: "guardian-1", contactVersion: 1 }, pepper)).resolves.toMatchObject({ eligible: false, reason: "CONTACT_VERSION_CHANGED" });
    await expect(recheckDispatchDestination(client, { channel: "EMAIL", recipientSubjectType: "GUARDIAN", recipientSubjectReferenceId: "guardian-1" }, pepper)).resolves.toMatchObject({ eligible: true, contactPointId: "contact-2", contactVersion: 2 });
  });

  it("resolves and deduplicates active guardians using server-owned relationships", async () => {
    const client = { studentGuardian: { findMany: async () => [
      { guardianId: "guardian-1", guardian: { users: [{ id: "parent-user-1", role: "PARENT" }] } },
      { guardianId: "guardian-1", guardian: { users: [{ id: "parent-user-1", role: "PARENT" }] } },
      { guardianId: "guardian-2", guardian: { users: [{ id: "parent-user-2", role: "PARENT" }] } }
    ] } };
    const recipients = await resolveCommunicationRecipients(client, { policy: "ACTIVE_GUARDIANS_FOR_STUDENTS", scope: { studentIds: ["student-1", "student-2"] }, actorUserId: "actor" });
    expect(recipients.map((row) => row.subjectReferenceId)).toEqual(["guardian-1", "guardian-2"]);
  });

  it("signs, verifies, deduplicates, and refuses delivery-state downgrades", async () => {
    const sink = new LocalSyntheticCommunicationSink();
    const secret = "synthetic-webhook-secret-at-least-24";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ events: [{ eventKey: "event-1", providerMessageId: "synthetic.message-1", state: "DELIVERED", occurredAt: new Date().toISOString() }] });
    const signature = signSyntheticCommunicationWebhook(rawBody, timestamp, secret);
    const webhookRows = new Map<string, any>(), item = { id: "item-1", state: "SENT", providerMessageId: "synthetic.message-1", providerProfileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", sentAt: new Date(), updatedAt: new Date() };
    let messageLookup: any, transitionWhere: any;
    const client: any = {
      communicationWebhookEvent: { findUnique: async ({ where }: any) => webhookRows.get(where.providerEventKey) ?? null, update: async ({ where, data }: any) => { const row = webhookRows.get(where.id) ?? webhookRows.get(where.providerEventKey); row.duplicateCount += data.duplicateCount.increment; return row; } },
      $transaction: async (run: any) => run(client),
      communicationOutboxItem: { findFirst: async ({ where }: any) => { messageLookup = where; return item; }, updateMany: async ({ where, data }: any) => { transitionWhere = where; Object.assign(item, data); return { count: 1 }; } },
      communicationDeliveryReceipt: { create: async ({ data }: any) => data },
    };
    client.communicationWebhookEvent.create = async ({ data }: any) => { const row = { id: data.providerEventKey, duplicateCount: 0, ...data }; webhookRows.set(data.providerEventKey, row); webhookRows.set(row.id, row); return row; };
    const first = await processCommunicationWebhook(client, { profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", rawBody, contentType: "application/json", timestamp, signature, secret, adapter: sink });
    expect(first.processed).toBe(1);
    expect(item.state).toBe("DELIVERED");
    expect(messageLookup).toMatchObject({ providerMessageId: "synthetic.message-1", providerProfileCode: "SYNTHETIC_EMAIL", channel: "EMAIL" });
    expect(transitionWhere).toMatchObject({ id: "item-1", state: "SENT", updatedAt: item.updatedAt });
    const second = await processCommunicationWebhook(client, { profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", rawBody, contentType: "application/json", timestamp, signature, secret, adapter: sink });
    expect(second.duplicated).toBe(1);
    await expect(processCommunicationWebhook(client, { profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", rawBody: `${rawBody} `, contentType: "application/json", timestamp, signature, secret, adapter: sink })).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("excludes encrypted destinations, push tokens, and temporary leases from backup", () => {
    const base = Object.fromEntries(COMMUNICATION_BACKUP_KEYS.map((key) => [key, []])) as Record<string, unknown>;
    base.communicationContactPoints = [{ id: "cp-1", identityKey: "synthetic", subjectType: "SYNTHETIC", subjectReferenceId: "person-1", channel: "EMAIL", contactType: "EMAIL", version: 1, status: "VERIFIED", destinationDigest: "a".repeat(64), destinationMasked: "s***@example.invalid", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    base.communicationProviderProfiles = [{ id: "profile-1", profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", adapterKind: "LOCAL_SYNTHETIC_SINK", environment: "SYNTHETIC", status: "ACTIVE", operationalEnabled: true, templateMappingJson: "{}", ratePolicyJson: "{}", costPolicyJson: "{}", circuitState: "CLOSED", consecutiveFailureCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    const backup = validateCommunicationBackupRows(base);
    expect(backup.communicationProviderProfiles[0]).toMatchObject({ status: "DISABLED", operationalEnabled: false });
    expect(JSON.stringify(backup)).not.toMatch(/encryptedDestinationSnapshot|encryptedTokenSnapshot|leaseOwner|leaseToken|leaseExpiresAt/);
  });

  it("maps restore ownership, skips unresolved identities, and never overwrites append-only evidence", async () => {
    const maps = { users: new Map([["backup-user", "local-user"]]), guardians: new Map<string, string>(), staffMembers: new Map<string, string>(), restoredBy: "restore-operator" };
    const result = () => Object.fromEntries(COMMUNICATION_BACKUP_KEYS.map((key) => [key, { created: 0, updated: 0, skipped: 0, errors: [] as string[] }])) as any;
    const mappedBackup = emptyCommunicationBackup();
    mappedBackup.communicationContactPoints.push({ id: "cp-1", identityKey: "backup-user", subjectType: "USER", subjectReferenceId: "backup-user", channel: "EMAIL", contactType: "EMAIL", version: 1, status: "VERIFIED", destinationDigest: "a".repeat(64), destinationMasked: "s***@example.invalid", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    mappedBackup.communicationContactPoints.push({ id: "cp-2", identityKey: "missing-user", subjectType: "USER", subjectReferenceId: "missing-user", channel: "EMAIL", contactType: "EMAIL", version: 1, status: "VERIFIED", destinationDigest: "b".repeat(64), destinationMasked: "s***@example.invalid", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const created: any[] = [];
    const client: any = { communicationContactPoint: { findUnique: async () => null, create: async ({ data }: any) => { created.push(data); return data; } } };
    const mappedResult = result();
    await restoreCommunicationBackup(client, mappedBackup, mappedResult, maps);
    expect(created[0]).toMatchObject({ identityKey: "local-user", subjectReferenceId: "local-user" });
    expect(mappedResult.communicationContactPoints).toMatchObject({ created: 1, skipped: 1, errors: [] });

    const appendOnlyBackup = emptyCommunicationBackup();
    appendOnlyBackup.communicationAttempts.push({ id: "attempt-1" });
    let overwriteCalled = false;
    const appendOnlyClient: any = { communicationAttempt: { findUnique: async () => ({ id: "attempt-1" }), update: async () => { overwriteCalled = true; } } };
    const appendOnlyResult = result();
    await restoreCommunicationBackup(appendOnlyClient, appendOnlyBackup, appendOnlyResult, maps);
    expect(overwriteCalled).toBe(false);
    expect(appendOnlyResult.communicationAttempts.skipped).toBe(1);
  });

  it("fails the public-source gate closed for an unreviewed text extension", () => {
    const fixture = path.resolve("tests", "communication-public-scan-synthetic.csv");
    writeFileSync(fixture, ["-----BEGIN", "PRIVATE KEY-----"].join(" "), { flag: "wx" });
    try {
      const exactHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8", windowsHide: true }).stdout.trim();
      const run = spawnSync(process.execPath, [path.resolve("node_modules", "tsx", "dist", "cli.mjs"), "scripts/qa-communication-delivery-foundation-1a-public-repo-scan.ts"], {
        cwd: process.cwd(),
        encoding: "utf8",
        windowsHide: true,
        env: { ...process.env, COMMUNICATION_DIFF_BASE_SHA: exactHead }
      });
      expect(run.status).not.toBe(0);
      expect(`${run.stdout}\n${run.stderr}`).toContain("communication-public-scan-synthetic.csv:unreviewed-extension");
    } finally {
      unlinkSync(fixture);
    }
  });

  it("keeps v44 backups restorable with empty communication collections", () => {
    const legacy = createBackupDocument({
      generatedAt: new Date("2026-09-04T00:00:00.000Z"),
      generatedBy: "COMMUNICATION_SYNTHETIC_QA",
      students: [], feeStructures: [], payments: [], paymentAudits: [], users: []
    }) as any;
    legacy.metadata.backupVersion = 44;
    for (const key of COMMUNICATION_BACKUP_KEYS) {
      delete legacy[key];
      delete legacy.metadata.counts[key];
    }
    const restored = parseAndValidateBackup(legacy);
    for (const key of COMMUNICATION_BACKUP_KEYS) expect(restored[key]).toEqual([]);
  });

  it("maintains SQLite/PostgreSQL model parity without touching OCR schemas", () => {
    const sqlite = readFileSync("prisma/schema.prisma", "utf8"), postgres = readFileSync("prisma/postgresql/schema.prisma", "utf8");
    for (const model of ["CommunicationContactPoint", "CommunicationTemplateDefinition", "CommunicationTemplateVersion", "CommunicationPreference", "CommunicationConsent", "CommunicationProviderProfile", "CommunicationIntent", "CommunicationOutboxItem", "CommunicationAttempt", "CommunicationDeliveryReceipt", "CommunicationWebhookEvent", "NativePushEndpoint", "CommunicationAuditEvent"]) {
      expect(sqlite).toContain(`model ${model} {`);
      expect(postgres).toContain(`model ${model} {`);
    }
    expect(readFileSync("prisma/migrations/20260904120000_communication_delivery_foundation_1a/migration.sql", "utf8")).not.toMatch(/FeeRegisterOcr|Ocr/);
    expect(readFileSync("prisma/postgresql/migrations/20260904120000_communication_delivery_foundation_1a/migration.sql", "utf8")).not.toMatch(/FeeRegisterOcr|Ocr/);
  });
});
