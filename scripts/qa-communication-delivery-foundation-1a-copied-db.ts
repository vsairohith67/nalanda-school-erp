import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { LocalSyntheticCommunicationSink, DisabledCommunicationAdapter, signSyntheticCommunicationWebhook } from "@/lib/communication-adapters";
import { renderCommunicationTemplate } from "@/lib/communication-templates";
import { createCommunicationIntent, processCommunicationOutbox } from "@/lib/communication-service";
import { processCommunicationWebhook } from "@/lib/communication-webhooks";
import { COMMUNICATION_BACKUP_KEYS, loadCommunicationBackup, restoreCommunicationBackup, validateCommunicationBackupRows } from "@/lib/communication-backup";
import { safeDestinationDigest } from "@/lib/communication-policy";

const SUITE = "COMMUNICATIONDELIVERYFOUNDATION1A";
const workspace = path.resolve(".");
const defaultOperational = path.join(process.env.USERPROFILE ?? "C:\\Users\\rohit", "Documents", "school software", "prisma", "dev.db");
const root = path.join(workspace, "tmp", `communication-delivery-1a-${process.pid}`);
const ciSyntheticBaseline = process.env.COMMUNICATION_CREATE_CI_BASELINE === "1";
const operational = ciSyntheticBaseline ? path.join(root, "ci-operational-baseline.db") : path.resolve(process.env.COMMUNICATION_OPERATIONAL_DB?.trim() || process.env.FINAL_SCOPE_OPERATIONAL_DB_PATH?.trim() || defaultOperational);
const copiedDatabase = path.join(root, "copy.db");
const freshDatabase = path.join(root, "fresh.db");
const restoreDatabase = path.join(root, "restore.db");
const keep = process.argv.includes("--keep");
let stage = "preflight";

type Identity = { sha256: string; size: number; lastWriteUtc: string; sidecars: string[] };
function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function identity(file: string): Identity {
  const stat = statSync(file);
  return { sha256: createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase(), size: stat.size, lastWriteUtc: stat.mtime.toISOString(), sidecars: ["-wal", "-shm", "-journal"].filter((suffix) => existsSync(`${file}${suffix}`)) };
}
function databaseUrl(file: string) { return `file:${path.resolve(file).replaceAll("\\", "/")}`; }
function prismaFor(file: string) { return new PrismaClient({ datasourceUrl: databaseUrl(file) }); }
function migrate(file: string, schema = "prisma/schema.prisma") {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const execute = (diagnostic = false) => spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", schema], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file), DATABASE_PROVIDER: "sqlite", ...(diagnostic ? { RUST_BACKTRACE: "1", RUST_LOG: "info" } : {}) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  let run = execute();
  if (!run.error && run.status !== 0 && `${run.stdout}\n${run.stderr}`.includes("Schema engine error")) run = execute(true);
  if (run.error || run.status !== 0) throw new Error(`${SUITE}_MIGRATION_FAILED:${run.error?.message ?? `${run.stdout}\n${run.stderr}`}`);
  return `${run.stdout}\n${run.stderr}`;
}
function createCiSyntheticBaseline() {
  invariant(process.env.CI === "true" && process.env.NALANDA_ENVIRONMENT === "TEST" && process.env.RELEASE_CI_SYNTHETIC_OPT_IN === "true", `${SUITE}_CI_BASELINE_OPT_IN_REQUIRED`);
  const legacyPrisma = path.join(root, "legacy-prisma"), legacyMigrations = path.join(legacyPrisma, "migrations");
  mkdirSync(legacyMigrations, { recursive: true });
  copyFileSync(path.join(workspace, "prisma", "schema.prisma"), path.join(legacyPrisma, "schema.prisma"));
  for (const entry of readdirSync(path.join(workspace, "prisma", "migrations"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "20260904120000_communication_delivery_foundation_1a") continue;
    cpSync(path.join(workspace, "prisma", "migrations", entry.name), path.join(legacyMigrations, entry.name), { recursive: true });
  }
  migrate(operational, path.join(legacyPrisma, "schema.prisma"));
}
function cleanup() {
  const target = path.resolve(root), permitted = path.resolve(workspace, "tmp");
  invariant(target.startsWith(`${permitted}${path.sep}`) && path.basename(target) === `communication-delivery-1a-${process.pid}`, `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
function resultBuckets() { return Object.fromEntries(COMMUNICATION_BACKUP_KEYS.map((key) => [key, { created: 0, updated: 0, skipped: 0, errors: [] as string[] }])); }
function percentile(values: number[], value: number) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0; }

async function main() {
  cleanup(); mkdirSync(root, { recursive: true });
  if (ciSyntheticBaseline) createCiSyntheticBaseline();
  invariant(existsSync(operational), `${SUITE}_OPERATIONAL_DATABASE_MISSING`);
  const before = identity(operational);
  invariant(before.sidecars.length === 0, `${SUITE}_OPERATIONAL_SIDECAR_PRESENT`);
  copyFileSync(operational, copiedDatabase);

  stage = "SQLite fresh, copied, repeat, and restore migrations";
  const freshOutput = migrate(freshDatabase), copiedOutput = migrate(copiedDatabase), repeatOutput = migrate(copiedDatabase), restoreOutput = migrate(restoreDatabase);
  invariant(freshOutput.includes("20260904120000_communication_delivery_foundation_1a"), `${SUITE}_FRESH_MIGRATION_MISSING`);
  invariant(copiedOutput.includes("20260904120000_communication_delivery_foundation_1a"), `${SUITE}_COPIED_MIGRATION_MISSING`);
  invariant(repeatOutput.includes("No pending migrations"), `${SUITE}_REPEAT_MIGRATION_NOT_IDEMPOTENT`);
  invariant(restoreOutput.includes("20260904120000_communication_delivery_foundation_1a"), `${SUITE}_RESTORE_MIGRATION_MISSING`);

  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_PROVIDER: "sqlite",
    DATABASE_URL: databaseUrl(copiedDatabase),
    APP_ORIGIN: "http://127.0.0.1:3000",
    RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY",
    RELEASE_FEATURE_FLAGS_QA_ENABLED: ["communication-delivery-foundation-1a", "communication-channel-in-app", "communication-channel-email", "communication-channel-sms", "communication-channel-whatsapp", "communication-channel-native-push"].join(",")
  });
  const client = prismaFor(copiedDatabase), restoreClient = prismaFor(restoreDatabase);
  const pepper = "synthetic-communication-pepper-2026-09-04";
  const sink = new LocalSyntheticCommunicationSink();
  const timings: number[] = [];
  let passed = false;
  try {
    stage = "deterministic 1,000-item in-app and outbound dataset";
    const now = new Date("2026-09-04T06:00:00.000Z");
    const renderedEmail = renderCommunicationTemplate({ templateKey: "PAYMENT_RECEIPT_AVAILABLE", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { schoolDisplayName: "Nalanda Synthetic School" } });
    const renderedInApp = renderCommunicationTemplate({ templateKey: "PAYMENT_RECEIPT_AVAILABLE", version: 1, locale: "en-IN", channel: "IN_APP", substitutions: { schoolDisplayName: "Nalanda Synthetic School" } });
    const intent = await client.communicationIntent.create({ data: { id: "synthetic-bulk-intent", eventType: "PAYMENT_COMMITTED", purpose: "TRANSACTIONAL", module: "FINANCE", sourceRecordType: "SYNTHETIC_RECEIPT", sourceRecordId: "synthetic-bulk", sourceEventId: "synthetic-bulk-event", recipientPolicy: "SYNTHETIC_REVIEWED_SNAPSHOT", recipientPolicyVersion: 1, recipientScopeJson: JSON.stringify({ synthetic: true, count: 1000 }), eligibleChannelsJson: JSON.stringify(["IN_APP", "EMAIL"]), templateKey: "PAYMENT_RECEIPT_AVAILABLE", templateVersion: 1, localePreference: "en-IN", priority: "TRANSACTIONAL", deduplicationKey: sha256("synthetic-bulk-dedup"), idempotencyKey: sha256("synthetic-bulk-idempotency"), initiatingActorId: "synthetic-super-admin", authorizingContextJson: JSON.stringify({ largeAudienceApproved: true, stepUpGrantId: "synthetic-step-up", audiencePreviewed: true }), audienceSnapshotHash: sha256("synthetic-reviewed-audience-1000"), state: "RESOLVED", createdAt: now, updatedAt: now } });
    await client.communicationProviderProfile.create({ data: { id: "synthetic-email-profile", profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", adapterKind: "LOCAL_SYNTHETIC_SINK", environment: "SYNTHETIC", status: "DISABLED", operationalEnabled: false, templateMappingJson: "{}", ratePolicyJson: JSON.stringify({ synthetic: true, perMinute: 1000 }), costPolicyJson: JSON.stringify({ synthetic: true, currency: "SYNTHETIC", unitMinor: 1 }), circuitState: "CLOSED", createdAt: now, updatedAt: now } });
    const inAppRows = [], emailRows = [];
    for (let index = 0; index < 1_000; index++) {
      const reference = `person-${String(index + 1).padStart(4, "0")}`;
      const common = { intentId: intent.id, recipientUserId: null, recipientSubjectType: "SYNTHETIC", recipientSubjectReferenceId: reference, contactVersion: 1, locale: "en-IN", templateKey: "PAYMENT_RECEIPT_AVAILABLE", templateVersion: 1, substitutionsJson: JSON.stringify({ schoolDisplayName: "Nalanda Synthetic School" }), priority: index === 999 ? "SECURITY" : index < 900 ? "OPTIONAL" : "TRANSACTIONAL", scheduledAt: now, expiresAt: new Date("2026-09-05T06:00:00.000Z"), attemptCount: 0, maximumAttempts: 4, nextAttemptAt: now, createdAt: new Date(now.getTime() + index), updatedAt: new Date(now.getTime() + index) };
      inAppRows.push({ ...common, id: `inapp-${reference}`, channel: "IN_APP", destinationDigest: null, destinationMasked: null, contentHash: renderedInApp.contentHash, deduplicationKey: sha256(`inapp-dedup-${reference}`), idempotencyKey: sha256(`inapp-idempotency-${reference}`), state: "DELIVERED", deliveredAt: now });
      emailRows.push({ ...common, id: `email-${reference}`, channel: "EMAIL", destinationDigest: safeDestinationDigest("EMAIL", `${reference}@example.invalid`, pepper), destinationMasked: `${reference.slice(0, 1)}***@example.invalid`, contentHash: renderedEmail.contentHash, deduplicationKey: sha256(`email-dedup-${reference}`), idempotencyKey: sha256(`email-idempotency-${reference}`), state: "QUEUED", providerProfileCode: "SYNTHETIC_EMAIL" });
    }
    await client.communicationOutboxItem.createMany({ data: inAppRows });
    await client.communicationOutboxItem.createMany({ data: emailRows });
    invariant(await client.communicationOutboxItem.count({ where: { channel: "IN_APP", state: "DELIVERED" } }) === 1_000, `${SUITE}_IN_APP_LOAD_COUNT_INVALID`);

    stage = "two-worker lease and priority load";
    for (let iteration = 0; iteration < 20; iteration++) {
      const started = performance.now();
      await Promise.all([
        processCommunicationOutbox(client, { channel: "EMAIL", workerId: "synthetic-worker-a", limit: 100, now, pepper, adapter: sink, simulation: "DELIVERED" }),
        processCommunicationOutbox(client, { channel: "EMAIL", workerId: "synthetic-worker-b", limit: 100, now, pepper, adapter: sink, simulation: "DELIVERED" })
      ]);
      timings.push(performance.now() - started);
      if (await client.communicationOutboxItem.count({ where: { channel: "EMAIL", state: "QUEUED" } }) === 0) break;
    }
    const outboundDelivered = await client.communicationOutboxItem.count({ where: { channel: "EMAIL", state: "DELIVERED", intentId: intent.id } });
    invariant(outboundDelivered === 1_000, `${SUITE}_OUTBOUND_LOAD_COUNT_INVALID:${outboundDelivered}`);
    invariant(sink.captured.length === 1_000 && new Set(sink.captured.map((row) => row.providerMessageId)).size === 1_000, `${SUITE}_DUPLICATE_SEND_DETECTED`);
    const securityAttempt = await client.communicationAttempt.findFirst({ where: { outboxItemId: "email-person-1000" } });
    invariant(Boolean(securityAttempt), `${SUITE}_SECURITY_PRIORITY_STARVED`);

    stage = "800-Student reviewed synthetic audience";
    const audienceStarted = performance.now();
    const audience = Array.from({ length: 800 }, (_, index) => ({ userId: null, subjectType: "SYNTHETIC" as const, subjectReferenceId: `student-${String(index + 1).padStart(4, "0")}`, role: "PARENT", locale: "en-IN" }));
    const resolved = await createCommunicationIntent(client, { eventType: "REPORT_ISSUED", purpose: "ACADEMIC_OPERATIONAL", module: "ACADEMICS", sourceRecordType: "SYNTHETIC_REPORT_BATCH", sourceRecordId: "synthetic-report-batch", sourceEventId: "synthetic-report-event", recipientPolicy: "SYNTHETIC_REVIEWED_AUDIENCE", recipientScope: { syntheticStudentCount: 800 }, eligibleChannels: ["IN_APP"], templateKey: "REPORT_AVAILABLE", templateVersion: 1, localePreference: "en-IN", priority: "NORMAL", expiresAt: new Date("2026-09-05T06:00:00.000Z"), deduplicationKey: "synthetic_report_audience_dedup", idempotencyKey: "synthetic_report_audience_idempotency", initiatingActorId: "synthetic-super-admin", authorizingContext: { largeAudienceApproved: true, stepUpGrantId: "synthetic-step-up", audiencePreviewed: true } }, { pepper, now, authorizeIntent: async (_client, authorisedInput) => ({ sourceRecordType: authorisedInput.sourceRecordType, sourceRecordId: authorisedInput.sourceRecordId, sourceEventId: authorisedInput.sourceEventId, recipientPolicy: authorisedInput.recipientPolicy, maximumAudience: 800, authorityReference: "synthetic-reviewed-report-batch" }), resolveRecipients: async () => audience });
    const audienceDurationMs = performance.now() - audienceStarted;
    invariant(resolved.items.length === 800 && new Set(resolved.items.map((row: any) => row.recipientSubjectReferenceId)).size === 800, `${SUITE}_AUDIENCE_RESOLUTION_INVALID`);

    stage = "bounded failure, retry, dead-letter, disabled-provider, and expiry scenarios";
    async function failureItem(label: string, purpose = "TRANSACTIONAL", maximumAttempts = 4, expiresAt = new Date("2026-09-05T06:00:00.000Z")) {
      const localIntent = await client.communicationIntent.create({ data: { eventType: "SYSTEM_INCIDENT_RECORDED", purpose, module: "TECHNICAL_OPERATIONS", sourceRecordType: "SYNTHETIC_FAILURE", sourceRecordId: label, sourceEventId: `${label}-event`, recipientPolicy: "SYNTHETIC_EXACT", recipientScopeJson: "{\"synthetic\":true}", eligibleChannelsJson: "[\"EMAIL\"]", templateKey: "SYSTEM_INCIDENT", templateVersion: 1, localePreference: "en-IN", priority: "NORMAL", deduplicationKey: sha256(`${label}-dedup`), idempotencyKey: sha256(`${label}-intent`), initiatingActorId: "synthetic-super-admin", authorizingContextJson: "{\"synthetic\":true}", state: "RESOLVED", createdAt: now, updatedAt: now } });
      const rendered = renderCommunicationTemplate({ templateKey: "SYSTEM_INCIDENT", version: 1, locale: "en-IN", channel: "EMAIL", substitutions: { schoolDisplayName: "Nalanda Synthetic School" } });
      return client.communicationOutboxItem.create({ data: { id: `failure-${label}`, intentId: localIntent.id, recipientSubjectType: "SYNTHETIC", recipientSubjectReferenceId: label, channel: "EMAIL", contactVersion: 1, destinationDigest: safeDestinationDigest("EMAIL", `${label}@example.invalid`, pepper), destinationMasked: "s***@example.invalid", locale: "en-IN", templateKey: "SYSTEM_INCIDENT", templateVersion: 1, substitutionsJson: JSON.stringify({ schoolDisplayName: "Nalanda Synthetic School" }), contentHash: rendered.contentHash, deduplicationKey: sha256(`${label}-item-dedup`), idempotencyKey: sha256(`${label}-item-idempotency`), state: "QUEUED", priority: "NORMAL", providerProfileCode: null, scheduledAt: now, expiresAt, attemptCount: 0, maximumAttempts, nextAttemptAt: now, createdAt: now, updatedAt: now } });
    }
    const timeout = await failureItem("timeout-before");
    await processCommunicationOutbox(client, { channel: "EMAIL", workerId: "failure-worker-timeout", limit: 1, now, pepper, adapter: sink, simulation: "TIMEOUT_BEFORE_ACCEPTANCE" });
    invariant((await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: timeout.id } })).state === "FAILED_RETRYABLE", `${SUITE}_TIMEOUT_NOT_RETRYABLE`);
    const rate = await failureItem("rate-limit", "TRANSACTIONAL", 1);
    await processCommunicationOutbox(client, { channel: "EMAIL", workerId: "failure-worker-rate", limit: 1, now, pepper, adapter: sink, simulation: "RATE_LIMIT" });
    invariant((await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: rate.id } })).state === "DEAD_LETTER", `${SUITE}_RATE_LIMIT_NOT_DEAD_LETTERED`);
    const disabled = await failureItem("provider-disabled");
    await processCommunicationOutbox(client, { channel: "EMAIL", workerId: "failure-worker-disabled", limit: 1, now, pepper, adapter: new DisabledCommunicationAdapter() });
    invariant((await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: disabled.id } })).state === "FAILED_PERMANENT", `${SUITE}_DISABLED_PROVIDER_FALSE_SUCCESS`);
    const expired = await failureItem("expired", "TRANSACTIONAL", 4, new Date("2026-09-04T05:59:59.000Z"));
    await processCommunicationOutbox(client, { channel: "EMAIL", workerId: "failure-worker-expired", limit: 1, now, pepper, adapter: sink });
    invariant((await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: expired.id } })).state === "EXPIRED", `${SUITE}_EXPIRED_ITEM_SENT`);
    const inflight = await failureItem("restore-inflight");
    await client.communicationOutboxItem.update({ where: { id: inflight.id }, data: { state: "CLAIMED", leaseOwner: "synthetic-interrupted-worker", leaseToken: randomUUID(), claimedAt: now, leaseExpiresAt: new Date(now.getTime() + 60_000) } });

    stage = "signed delivery receipt, replay, and monotonicity";
    const accepted = await failureItem("webhook-accepted");
    await processCommunicationOutbox(client, { channel: "EMAIL", workerId: "webhook-worker", limit: 1, now, pepper, adapter: sink, simulation: "ACCEPTED" });
    await client.communicationOutboxItem.update({ where: { id: accepted.id }, data: { providerProfileCode: "SYNTHETIC_EMAIL" } });
    const acceptedRow = await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: accepted.id } });
    invariant(acceptedRow.state === "ACCEPTED_BY_PROVIDER" && acceptedRow.providerMessageId, `${SUITE}_PROVIDER_ACCEPTANCE_MISSING`);
    const secret = "synthetic-webhook-secret-at-least-24", timestamp = String(Math.floor(now.getTime() / 1000));
    const rawBody = JSON.stringify({ events: [{ eventKey: "synthetic-delivery-event", providerMessageId: acceptedRow.providerMessageId, state: "DELIVERED", occurredAt: now.toISOString() }] });
    const webhookInput = { profileCode: "SYNTHETIC_EMAIL", channel: "EMAIL", rawBody, contentType: "application/json", timestamp, signature: signSyntheticCommunicationWebhook(rawBody, timestamp, secret), secret, adapter: sink, now };
    invariant((await processCommunicationWebhook(client, webhookInput)).processed === 1, `${SUITE}_SIGNED_WEBHOOK_NOT_PROCESSED`);
    invariant((await processCommunicationWebhook(client, webhookInput)).duplicated === 1, `${SUITE}_WEBHOOK_REPLAY_NOT_DEDUPLICATED`);
    invariant((await client.communicationOutboxItem.findUniqueOrThrow({ where: { id: accepted.id } })).state === "DELIVERED", `${SUITE}_DELIVERY_STATE_NOT_RECONCILED`);

    stage = "governed communication backup and restore twice";
    const backup = validateCommunicationBackupRows(await loadCommunicationBackup(client));
    const serialized = JSON.stringify(backup);
    invariant(!/(encryptedDestinationSnapshot|encryptedTokenSnapshot|leaseOwner|leaseToken|leaseExpiresAt|apiKey|webhookSecret|smtpPassword)/i.test(serialized), `${SUITE}_BACKUP_SECRET_BOUNDARY_FAILED`);
    const firstRestore = resultBuckets() as any;
    const restoreIdentityMaps = { users: new Map<string, string>(), guardians: new Map<string, string>(), staffMembers: new Map<string, string>(), restoredBy: "synthetic-super-admin" };
    await restoreCommunicationBackup(restoreClient, backup, firstRestore, restoreIdentityMaps);
    const firstRestoreErrors = Object.fromEntries(Object.entries(firstRestore).filter(([, value]: any) => value.errors.length).map(([key, value]: any) => [key, value.errors.slice(0, 3)]));
    invariant(Object.keys(firstRestoreErrors).length === 0, `${SUITE}_FIRST_RESTORE_FAILED:${JSON.stringify(firstRestoreErrors)}`);
    const secondRestore = resultBuckets() as any;
    await restoreCommunicationBackup(restoreClient, backup, secondRestore, restoreIdentityMaps);
    const secondRestoreErrors = Object.fromEntries(Object.entries(secondRestore).filter(([, value]: any) => value.errors.length).map(([key, value]: any) => [key, value.errors.slice(0, 3)]));
    invariant(Object.keys(secondRestoreErrors).length === 0, `${SUITE}_SECOND_RESTORE_FAILED:${JSON.stringify(secondRestoreErrors)}`);
    invariant(await restoreClient.communicationOutboxItem.count({ where: { state: "DELIVERED" } }) === await client.communicationOutboxItem.count({ where: { state: "DELIVERED" } }), `${SUITE}_RESTORE_STATE_MISMATCH`);
    invariant(await restoreClient.communicationOutboxItem.count({ where: { state: "DEAD_LETTER" } }) === 2, `${SUITE}_DEAD_LETTER_RESTORE_COUNT_INVALID`);
    const restoredInflight = await restoreClient.communicationOutboxItem.findUniqueOrThrow({ where: { id: inflight.id } });
    invariant(restoredInflight.state === "DEAD_LETTER" && restoredInflight.lastSafeErrorCode === "RESTORED_INFLIGHT_REQUIRES_REVIEW", `${SUITE}_RESTORED_INFLIGHT_NOT_NORMALIZED`);
    invariant((await restoreClient.communicationProviderProfile.findUniqueOrThrow({ where: { profileCode: "SYNTHETIC_EMAIL" } })).operationalEnabled === false, `${SUITE}_PROVIDER_ENABLED_ON_RESTORE`);
    for (const [label, delegate, row] of [
      ["ATTEMPT", restoreClient.communicationAttempt, await restoreClient.communicationAttempt.findFirstOrThrow()],
      ["RECEIPT", restoreClient.communicationDeliveryReceipt, await restoreClient.communicationDeliveryReceipt.findFirstOrThrow()],
      ["AUDIT", restoreClient.communicationAuditEvent, await restoreClient.communicationAuditEvent.findFirstOrThrow()]
    ] as const) {
      let updateDenied = false, deleteDenied = false;
      try { await delegate.update({ where: { id: row.id }, data: { id: row.id } }); } catch { updateDenied = true; }
      try { await delegate.delete({ where: { id: row.id } }); } catch { deleteDenied = true; }
      invariant(updateDenied && deleteDenied, `${SUITE}_${label}_EVIDENCE_NOT_IMMUTABLE`);
    }

    const after = identity(operational);
    invariant(JSON.stringify(after) === JSON.stringify(before), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    const memory = process.memoryUsage();
    const result = {
      suite: SUITE,
      status: "PASS",
      operationalDatabase: { path: operational, before, after, byteIdentical: true },
      migration: { fresh: true, copiedUpgrade: true, repeatDeploy: true, restoreTarget: true },
      load: { inAppNotifications: 1_000, outboundDelivered, audienceResolved: resolved.items.length, syntheticSinkUniqueAttempts: sink.captured.length },
      concurrency: { workers: 2, duplicateSends: 0, priorityStarvation: false },
      performance: { audienceResolutionMs: Math.round(audienceDurationMs), workerBatchP50Ms: Math.round(percentile(timings, 0.50)), workerBatchP95Ms: Math.round(percentile(timings, 0.95)), rssMiB: Math.round(memory.rss / 1024 / 1024) },
      failureScenarios: { timeoutBeforeAcceptance: "FAILED_RETRYABLE", rateLimitAtMaximumAttempts: "DEAD_LETTER", providerDisabled: "FAILED_PERMANENT", expired: "EXPIRED", signedWebhook: "DELIVERED", duplicateWebhook: "IGNORED", restoredInflight: "DEAD_LETTER_REQUIRES_REVIEW" },
      backup: { version: 45, arrays: COMMUNICATION_BACKUP_KEYS.length, firstRestore: "PASS", secondRestore: "PASS", providersRemainDisabled: true, appendOnlyEvidenceTriggers: 6 },
      networkCalls: 0,
      realRecipients: 0,
      realMessages: 0
    };
    console.log(JSON.stringify(result, null, 2));
    passed = true;
    if (keep) console.log(`${SUITE}_FIXTURE_ROOT=${root}`);
  } finally {
    await Promise.allSettled([client.$disconnect(), restoreClient.$disconnect()]);
    if (passed && !keep) cleanup();
  }
}

main().catch((error) => {
  console.error(`${SUITE}_FAILED_AT=${stage}`);
  console.error(error);
  console.error(`${SUITE}_PRESERVED_ROOT=${root}`);
  process.exitCode = 1;
});
