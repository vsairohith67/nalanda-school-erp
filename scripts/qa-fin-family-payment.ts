import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import {
  confirmFamilyCollection,
  correctFamilyCollection,
  familyReceiptForUser,
  previewFamilyCollection,
  reverseFamilyCollection
} from "../lib/family-collections";
import { calculateCashSources } from "../lib/cash-book";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  cleanupIsolatedDatabase,
  databaseUrl,
  ensureQaRoot
} from "./migration-isolation";

const PREFIX = "fampay1-";
const MARKER = "FAMPAY1";
const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", "FAMPAY1-browser.db");
const STATE_PATH = path.join(QA_ROOT, "operational-copy", "FAMPAY1-state.json");
const RESTORE_PATH = path.join(QA_ROOT, "restore", "FAMPAY1-restore.db");
const ACADEMIC_YEAR = "2026-27";
const CLASS_NAME = "X";
const COLLECTION_DATE = "2026-08-08";
const QA_AUTH_VERIFICATION_VALUE = createHash("sha256").update(`${MARKER}|isolated-auth-verification`).digest("base64url");
const ROLES = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "VIEWER", "TEACHER", "PARENT"] as const;

type State = { databasePath: string; operationalHash: string; browserAccessValue: string; guardianKey: string; browserGuardianKey: string };

async function main() {
  process.env.AUTH_VERIFICATION_SECRET = QA_AUTH_VERIFICATION_VALUE;
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "prepare") return prepare();
  if (action === "exercise") return exercise();
  if (action === "governance") return governance();
  if (action === "inspect") return inspect();
  if (action === "restore") return restoreRehearsal();
  if (action === "restore-existing") return restoreExistingBackup(String(process.argv[3] ?? ""));
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, exercise, governance, inspect, restore, restore-existing <backup>, cleanup, or destroy");
}

async function prepare() {
  ensureQaRoot();
  const databasePath = assertIsolatedDatabasePath(DATABASE_PATH);
  if (existsSync(databasePath)) cleanupIsolatedDatabase(databasePath);
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
  const operationalHash = fileHash(OPERATIONAL_DATABASE);
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  migrate(databasePath);
  const prisma = client(databasePath);
  try {
    const browserAccessValue = `${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    await cleanupMarkers(prisma);
    for (const role of ROLES) {
      const username = `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}`;
      const user = await prisma.user.create({ data: {
        id: `${PREFIX}user-${role.toLowerCase().replaceAll("_", "-")}`,
        name: `${MARKER} ${role.replaceAll("_", " ")}`,
        username,
        passwordHash, role, isActive: true
      } });
      await prisma.authLoginAlias.create({ data: { id: `${PREFIX}alias-${role.toLowerCase().replaceAll("_", "-")}`, userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
      // The copied database already contains the protected operational Super Admin.
      // Keep the synthetic Super Admin as a role-fallback test account so cleanup
      // never attempts to delete immutable active-Super-Admin history.
      if (role !== "SUPER_ADMIN") {
        await prisma.userRoleAssignment.create({ data: { id: `${PREFIX}role-${role.toLowerCase().replaceAll("_", "-")}`, publicKey: `${PREFIX}role-public-${role.toLowerCase().replaceAll("_", "-")}`, userId: user.id, role, status: "ACTIVE", reason: `${MARKER} copied-database-only role fixture`, assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
      }
    }
    await ensureDefaultRolePermissions(prisma);
    await prisma.feeStructure.upsert({
      where: { academicYear_className: { academicYear: ACADEMIC_YEAR, className: CLASS_NAME } },
      create: { academicYear: ACADEMIC_YEAR, className: CLASS_NAME, termAmount: 12_000, term1Month: "June", term2Month: "September", term3Month: "December", term4Month: "March", active: true },
      update: { termAmount: 12_000, active: true }
    });
    const guardianKey = `${PREFIX}guardian-public`;
    const browserGuardianKey = `${PREFIX}browser-guardian-public`;
    const guardian = await prisma.guardian.create({ data: { id: `${PREFIX}guardian`, iamPublicKey: guardianKey, displayName: `${MARKER} Synthetic Family`, primaryMobile: "9000001101", notes: `${MARKER} copied-database-only` } });
    const browserGuardian = await prisma.guardian.create({ data: { id: `${PREFIX}guardian-browser`, iamPublicKey: browserGuardianKey, displayName: `${MARKER} Browser Family`, primaryMobile: "9000001102", notes: `${MARKER} copied-database-only` } });
    await prisma.user.update({ where: { id: `${PREFIX}user-parent` }, data: { guardianId: guardian.id } });
    for (let index = 1; index <= 8; index += 1) {
      const browser = index > 4;
      const suffix = String(index).padStart(3, "0");
      const student = await prisma.student.create({ data: {
        id: `${PREFIX}student-${suffix}`, academicYear: ACADEMIC_YEAR, admissionNo: `${MARKER}-${suffix}`,
        studentName: `${MARKER} Student ${index}`, fatherName: `${MARKER} Guardian`, phone1: `9000002${suffix}`,
        className: CLASS_NAME, section: browser ? "B" : "A", status: "Active", remarks: `${MARKER} copied-database-only fixture`
      } });
      await prisma.academicYearEnrollment.create({ data: {
        id: `${PREFIX}enrollment-${suffix}`, studentId: student.id, academicYear: ACADEMIC_YEAR,
        className: CLASS_NAME, section: browser ? "B" : "A", status: "ACTIVE", enrollmentDate: new Date(`${COLLECTION_DATE}T00:00:00.000Z`), notes: `${MARKER} copied-database-only fixture`
      } });
      await prisma.studentGuardian.create({ data: {
        id: `${PREFIX}link-${suffix}`, studentId: student.id, guardianId: browser ? browserGuardian.id : guardian.id,
        relationshipToStudent: "Parent", isPrimaryContact: true, canViewFees: true, canReceiveReminders: true
      } });
    }
    writeFileSync(STATE_PATH, JSON.stringify({ databasePath, operationalHash, browserAccessValue, guardianKey, browserGuardianKey } satisfies State, null, 2));
    assertOperationalHash(operationalHash);
    console.log(JSON.stringify({ status: "FAMPAY1_COPY_PREPARED", databasePath, databaseUrl: databaseUrl(databasePath), usernames: ROLES.map((role) => `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}`), credentials: "Stored only in ignored FAMPAY1 state; not printed", fixtureStudents: 8, operationalHash }));
  } finally { await prisma.$disconnect(); }
}

async function exercise() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const request = requestFor(state.guardianKey, [1, 2, 3, 4], "FAMPAY1-UPI-REF-1001");
    const preview = await previewFamilyCollection(prisma, request);
    assert(preview.totalPaise === 4_000_000, "TOTAL_NOT_40000");
    assert(preview.allocations.some((allocation) => preview.shares.filter((share) => share.allocationKey === allocation.clientKey).length === 2), "NO_SPLIT_CHILD_ALLOCATION");
    const confirmation = { ...request, planHash: preview.planHash, requestKey: "fampay1-confirm-main-001" };
    const posted = await confirmFamilyCollection(prisma, confirmation, actor());
    const retry = await confirmFamilyCollection(prisma, confirmation, actor());
    assert(posted.publicReference === retry.publicReference, "IDENTICAL_RETRY_DUPLICATED");
    await expectFailure(() => confirmFamilyCollection(prisma, { ...confirmation, instruments: [{ ...request.instruments[0], amountPaise: 2_900_000 }, request.instruments[1]] }, actor()), "different collection content");
    await expectFailure(() => confirmFamilyCollection(prisma, { ...request, instruments: [{ ...request.instruments[0], reference: "FAMPAY1 UPI REF 1001" }, request.instruments[1],], planHash: preview.planHash, requestKey: "fampay1-duplicate-ref" }, actor()), "already reserved");
    await expectFailure(() => confirmFamilyCollection(prisma, { ...request, instruments: [{ ...request.instruments[0], amountPaise: 2_900_000, reference: "FAMPAY1-STALEREF-1002" }, { ...request.instruments[1], amountPaise: 1_100_000 }], planHash: preview.planHash, requestKey: "fampay1-stale-plan" }, actor()), "stale or changed");
    await expectFailure(() => previewFamilyCollection(prisma, { ...request, guardianKey: state.browserGuardianKey }), "not linked");
    const collection = await prisma.familyCollection.findUniqueOrThrow({ where: { publicReference: posted.publicReference }, include: { instruments: true, allocations: { include: { shares: true } }, compatibilityPayments: true, receiptVersions: true, events: true, providerPlans: true } });
    assert(collection.instruments.length === 2 && collection.allocations.length === 4, "ROOT_GRAPH_SHAPE_INVALID");
    assert(collection.instruments.reduce((sum, row) => sum + row.amountPaise, 0) === collection.totalPaise, "INSTRUMENT_RECONCILIATION_FAILED");
    assert(collection.allocations.reduce((sum, row) => sum + row.amountPaise, 0) === collection.totalPaise, "ALLOCATION_RECONCILIATION_FAILED");
    assert(collection.compatibilityPayments.reduce((sum, row) => sum + Math.round(Number(row.amountPaid) * 100), 0) === collection.totalPaise, "LEDGER_RECONCILIATION_FAILED");
    assert(collection.receiptVersions.length === 1 && collection.events.length === 4 && collection.providerPlans.length === 1, "GOVERNANCE_GRAPH_INVALID");
    const parent = await prisma.user.findUniqueOrThrow({ where: { id: `${PREFIX}user-parent` } });
    const full = await familyReceiptForUser(prisma, posted.publicReference, parent);
    const extract = await familyReceiptForUser(prisma, posted.publicReference, parent, `${MARKER}-001`);
    assert(full.allocations.length === 4 && extract.allocations.length === 1, "PARENT_SCOPE_INVALID");
    const serialized = JSON.stringify(collection);
    assert(!serialized.includes("FAMPAY1-UPI-REF-1001") && serialized.includes("[MASKED]1001"), "RAW_REFERENCE_LEAKED");
    const cash = await calculateCashSources(prisma, new Date(`${COLLECTION_DATE}T00:00:00.000Z`), new Prisma.Decimal(0));
    assert(Number(cash.feeCash) === 10_000 && cash.counts.feePayments === 1, "CASH_BOOK_COMPONENT_COUNT_INVALID");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FAMPAY1_SCENARIOS_PASSED", publicReference: posted.publicReference, totalPaise: collection.totalPaise, instruments: collection.instruments.length, allocations: collection.allocations.length, shares: collection.allocations.reduce((sum, row) => sum + row.shares.length, 0), compatibilityPayments: collection.compatibilityPayments.length, receiptVersions: collection.receiptVersions.length, lifecycleEvents: collection.events.length, providerPlans: collection.providerPlans.length, parentFullChildren: full.allocations.length, childExtractChildren: extract.allocations.length, cashInstrumentCount: cash.counts.feePayments, operationalHash: state.operationalHash }));
  } finally { await prisma.$disconnect(); }
}

async function governance() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const original = await prisma.familyCollection.findUniqueOrThrow({ where: { requestKey: "fampay1-confirm-main-001" } });
    const replacementRequest = { ...requestFor(state.guardianKey, [1, 2, 3, 4], "FAMPAY1-CORRECTED-2001"), correctionOfReference: original.publicReference };
    const replacementPreview = await previewFamilyCollection(prisma, replacementRequest);
    const correctionInput = { expectedVersion: original.version, reason: `${MARKER} verified governed correction`, replacement: { ...replacementRequest, requestKey: "fampay1-correction-001", planHash: replacementPreview.planHash } };
    const corrected = await correctFamilyCollection(prisma, original.publicReference, correctionInput, actor());
    const correctedRetry = await correctFamilyCollection(prisma, original.publicReference, correctionInput, actor());
    assert(corrected.publicReference === correctedRetry.publicReference, "CORRECTION_RETRY_DUPLICATED");
    const [originalAfter, replacementAfter] = await Promise.all([
      prisma.familyCollection.findUniqueOrThrow({ where: { id: original.id }, include: { compatibilityPayments: true } }),
      prisma.familyCollection.findUniqueOrThrow({ where: { publicReference: corrected.publicReference }, include: { compatibilityPayments: true } })
    ]);
    assert(originalAfter.status === "SUPERSEDED" && originalAfter.compatibilityPayments.every((row) => row.isCancelled), "ORIGINAL_NOT_SUPERSEDED");
    assert(replacementAfter.status === "ISSUED" && replacementAfter.compatibilityPayments.every((row) => !row.isCancelled), "REPLACEMENT_NOT_ISSUED");

    await prisma.cashBookDay.create({ data: {
      id: `${PREFIX}locked-day`, cashDate: new Date(`${COLLECTION_DATE}T00:00:00.000Z`), academicYear: ACADEMIC_YEAR,
      openingBalance: new Prisma.Decimal(0), calculatedClosingBalance: new Prisma.Decimal(0),
      countedClosingBalance: new Prisma.Decimal(0), varianceAmount: new Prisma.Decimal(0),
      sourceSummarySnapshot: JSON.stringify({ fixture: MARKER, feeCashPaise: 0 }),
      status: "LOCKED", createdByUserId: actor().id
    } });
    const notificationsBefore = await prisma.notificationCampaign.count();
    await expectFailure(() => reverseFamilyCollection(prisma, corrected.publicReference, { expectedVersion: replacementAfter.version, reason: `${MARKER} locked-day Accountant review` }, actor()), "requires leadership review");
    const stillIssued = await prisma.familyCollection.findUniqueOrThrow({ where: { id: replacementAfter.id } });
    const notificationsAfter = await prisma.notificationCampaign.count();
    assert(stillIssued.status === "ISSUED" && notificationsAfter > notificationsBefore, "LOCKED_DAY_REVIEW_NOT_PRESERVED");
    const reversed = await reverseFamilyCollection(prisma, corrected.publicReference, { expectedVersion: replacementAfter.version, reason: `${MARKER} Director-approved governed reversal` }, { id: `${PREFIX}user-director`, name: `${MARKER} DIRECTOR`, role: "DIRECTOR" });
    assert(reversed.status === "REVERSED", "DIRECTOR_REVERSAL_FAILED");

    const concurrentRequest = requestFor(state.browserGuardianKey, [5, 6, 7, 8], "FAMPAY1-CONCURRENT-3001");
    const concurrentPreview = await previewFamilyCollection(prisma, concurrentRequest);
    const concurrentConfirmation = { ...concurrentRequest, requestKey: "fampay1-concurrent-001", planHash: concurrentPreview.planHash };
    const secondClient = client(state.databasePath);
    const concurrentResults = await Promise.allSettled([
      confirmFamilyCollection(prisma, concurrentConfirmation, actor()),
      confirmFamilyCollection(secondClient, concurrentConfirmation, actor())
    ]);
    await secondClient.$disconnect();
    const concurrentRows = await prisma.familyCollection.findMany({ where: { requestKey: "fampay1-concurrent-001" } });
    assert(concurrentRows.length === 1, "CONCURRENT_ROOT_COUNT_INVALID");
    const concurrencyRetry = await confirmFamilyCollection(prisma, concurrentConfirmation, actor());
    assert(concurrencyRetry.publicReference === concurrentRows[0].publicReference, "CONCURRENT_RETRY_NOT_STABLE");

    const beforeRollback = await familyCounts(prisma);
    const rollbackRequest = requestFor(state.browserGuardianKey, [5, 6, 7, 8], "FAMPAY1-ROLLBACK-4001");
    const rollbackPreview = await previewFamilyCollection(prisma, rollbackRequest);
    await expectFailure(() => confirmFamilyCollection(prisma, { ...rollbackRequest, requestKey: "fampay1-rollback-001", planHash: rollbackPreview.planHash }, { id: `${PREFIX}missing-actor`, name: `${MARKER} Missing Actor`, role: "ACCOUNTANT" }), "foreign key");
    const afterRollback = await familyCounts(prisma);
    assert(JSON.stringify(beforeRollback) === JSON.stringify(afterRollback), "FORCED_FAILURE_DID_NOT_ROLL_BACK");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FAMPAY1_GOVERNANCE_PASSED", originalStatus: originalAfter.status, replacementFinalStatus: reversed.status, correctionRetryStable: true, lockedDayNotificationPersisted: true, concurrencyOutcomes: concurrentResults.map((row) => row.status), concurrentRootCount: concurrentRows.length, forcedRollbackCountStable: true, operationalHash: state.operationalHash }));
  } finally { await prisma.$disconnect(); }
}

async function inspect() {
  const state = readState(), prisma = client(state.databasePath);
  try {
    const [collections, instruments, allocations, shares, receipts, events, plans, payments] = await Promise.all([
      prisma.familyCollection.count(), prisma.familyCollectionInstrument.count(), prisma.familyStudentAllocation.count(), prisma.allocationInstrumentShare.count(), prisma.familyReceiptVersion.count(), prisma.familyCollectionEvent.count(), prisma.familyProviderAllocationPlan.count(), prisma.payment.count({ where: { familyCollectionId: { not: null } } })
    ]);
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FAMPAY1_COPY_INSPECTED", collections, instruments, allocations, shares, receipts, events, plans, compatibilityPayments: payments, operationalHash: state.operationalHash }));
  } finally { await prisma.$disconnect(); }
}

async function restoreRehearsal() {
  const state = readState();
  const targetPath = assertIsolatedDatabasePath(RESTORE_PATH);
  if (existsSync(targetPath)) cleanupIsolatedDatabase(targetPath);
  writeFileSync(targetPath, "");
  migrate(targetPath);
  const source = client(state.databasePath), target = client(targetPath);
  try {
    const expectedCounts = await familyCounts(source);
    const backup = await generateFullBackup(source, { generatedAt: new Date("2026-08-08T12:00:00.000Z"), generatedBy: "FAMPAY1 isolated rehearsal" });
    const serialized = serializeBackup(backup);
    assert(!serialized.includes(QA_AUTH_VERIFICATION_VALUE) && backup.users.every((row) => !("passwordHash" in row)), "BACKUP_SECRET_LEAK");
    const validated = parseAndValidateBackup(JSON.parse(serialized));
    assert(validated.metadata.backupVersion === 42, "BACKUP_VERSION_CHANGED");
    await target.user.create({ data: { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor`, username: `${PREFIX}restore-actor`, passwordHash: await hashPassword("FAMPAY1-local-only-restore-actor!Aa9"), role: "DIRECTOR", isActive: true } });
    const first = await restoreValidatedBackup(target, validated, { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor` });
    assertNoRestoreErrors(first as unknown as Record<string, unknown>);
    const beforeSecond = await familyCounts(target);
    const second = await restoreValidatedBackup(target, validated, { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor` });
    assertNoRestoreErrors(second as unknown as Record<string, unknown>);
    const afterSecond = await familyCounts(target);
    assert(JSON.stringify(beforeSecond) === JSON.stringify(afterSecond), "SECOND_RESTORE_CHANGED_COUNTS");
    assert(JSON.stringify(beforeSecond) === JSON.stringify(expectedCounts), "RESTORED_FAMILY_GRAPH_INVALID");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FAMPAY1_BACKUP_RESTORE_TWICE_PASSED", backupVersion: validated.metadata.backupVersion, ...beforeSecond, secondRestoreCountStable: true, operationalHash: state.operationalHash }));
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
    cleanupIsolatedDatabase(targetPath);
  }
}

async function restoreExistingBackup(backupPathInput: string) {
  const backupPath = path.resolve(backupPathInput);
  const backupRoot = `${path.resolve("backups")}${path.sep}`;
  if (!backupPath.startsWith(backupRoot) || !existsSync(backupPath)) throw new Error("FAMPAY1_EXISTING_BACKUP_PATH_REFUSED");
  const targetPath = assertIsolatedDatabasePath(RESTORE_PATH);
  if (existsSync(targetPath)) cleanupIsolatedDatabase(targetPath);
  writeFileSync(targetPath, "");
  migrate(targetPath);
  const target = client(targetPath);
  try {
    const validated = parseAndValidateBackup(JSON.parse(readFileSync(backupPath, "utf8")));
    assert(validated.metadata.backupVersion === 42, "EXISTING_BACKUP_VERSION_CHANGED");
    await target.user.create({ data: { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor`, username: `${PREFIX}restore-actor`, passwordHash: await hashPassword("FAMPAY1-local-only-restore-actor!Aa9"), role: "DIRECTOR", isActive: true } });
    const first = await restoreValidatedBackup(target, validated, { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor` });
    assertNoRestoreErrors(first as unknown as Record<string, unknown>);
    const afterFirst = await familyCounts(target);
    const second = await restoreValidatedBackup(target, validated, { id: `${PREFIX}restore-actor`, name: `${MARKER} Restore Actor` });
    assertNoRestoreErrors(second as unknown as Record<string, unknown>);
    const afterSecond = await familyCounts(target);
    assert(JSON.stringify(afterFirst) === JSON.stringify(afterSecond), "EXISTING_BACKUP_SECOND_RESTORE_CHANGED_COUNTS");
    const integrity = await target.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
    const foreignKeys = await target.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    assert(integrity[0]?.integrity_check === "ok" && foreignKeys.length === 0, "EXISTING_BACKUP_SQLITE_INTEGRITY_FAILED");
    console.log(JSON.stringify({ status: "FAMPAY1_EXISTING_BACKUP_RESTORE_TWICE_PASSED", backupVersion: validated.metadata.backupVersion, ...afterSecond, sqliteIntegrity: "ok", foreignKeyViolations: 0 }));
  } finally {
    await target.$disconnect();
    cleanupIsolatedDatabase(targetPath);
  }
}

async function cleanup() {
  const state = readState(), prisma = client(state.databasePath);
  try { const removed = await cleanupMarkers(prisma); assertOperationalHash(state.operationalHash); console.log(JSON.stringify({ status: "FAMPAY1_COPY_CLEAN", removed, operationalHash: state.operationalHash })); }
  finally { await prisma.$disconnect(); }
}

function destroy() {
  const state = readState();
  cleanupIsolatedDatabase(state.databasePath);
  rmSync(STATE_PATH, { force: true });
  assertOperationalHash(state.operationalHash);
  console.log(JSON.stringify({ status: "FAMPAY1_COPY_DESTROYED", operationalHash: state.operationalHash }));
}

async function familyCounts(prisma: PrismaClient) {
  const [collections, instruments, allocations, shares, receipts, events, plans, payments] = await Promise.all([
    prisma.familyCollection.count(), prisma.familyCollectionInstrument.count(), prisma.familyStudentAllocation.count(), prisma.allocationInstrumentShare.count(), prisma.familyReceiptVersion.count(), prisma.familyCollectionEvent.count(), prisma.familyProviderAllocationPlan.count(), prisma.payment.count({ where: { familyCollectionId: { not: null } } })
  ]);
  return { collections, instruments, allocations, shares, receipts, events, plans, payments };
}

function assertNoRestoreErrors(result: Record<string, unknown>) {
  const failures = Object.entries(result).flatMap(([key, value]) => value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as { errors?: unknown[] }).errors) && (value as { errors: unknown[] }).errors.length ? [`${key}:${(value as { errors: unknown[] }).errors.join("|")}`] : []);
  assert(!failures.length, `RESTORE_ENTITY_ERRORS_${failures.join("_")}`);
}

function requestFor(guardianKey: string, children: number[], reference: string) {
  return {
    payerType: "GUARDIAN", guardianKey, collectionDate: COLLECTION_DATE,
    students: children.map((index) => ({ admissionNo: `${MARKER}-${String(index).padStart(3, "0")}`, academicYear: ACADEMIC_YEAR })),
    instruments: [
      { clientKey: "upi", mode: "UPI", amountPaise: 3_000_000, receivedAccount: "NPS Current Account UPI", reference },
      { clientKey: "cash", mode: "CASH", amountPaise: 1_000_000, receivedAccount: "Cash" }
    ], allocationMode: "AUTO"
  };
}

async function cleanupMarkers(prisma: PrismaClient) {
  const collections = await prisma.familyCollection.findMany({ where: { OR: [{ requestKey: { startsWith: PREFIX } }, { payerDisplayName: { contains: MARKER } }] }, select: { id: true, publicReference: true } });
  const ids = collections.map((row) => row.id), refs = collections.map((row) => row.publicReference);
  const campaigns = await prisma.notificationCampaign.findMany({ where: { body: { contains: MARKER } }, select: { id: true } });
  const campaignIds = campaigns.map((row) => row.id);
  const recipients = await prisma.notificationRecipient.findMany({ where: { campaignId: { in: campaignIds } }, select: { id: true } });
  const recipientIds = recipients.map((row) => row.id);
  const removed: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    removed.paymentAudits = await tx.paymentAudit.deleteMany({ where: { payment: { familyCollectionId: { in: ids } } } }).then((row) => row.count);
    removed.payments = await tx.payment.deleteMany({ where: { familyCollectionId: { in: ids } } }).then((row) => row.count);
    removed.receiptNotes = await tx.receiptNote.deleteMany({ where: { receiptNo: { in: refs } } }).then((row) => row.count);
    removed.events = await tx.familyCollectionEvent.deleteMany({ where: { collectionId: { in: ids } } }).then((row) => row.count);
    removed.plans = await tx.familyProviderAllocationPlan.deleteMany({ where: { collectionId: { in: ids } } }).then((row) => row.count);
    await tx.familyReceiptVersion.updateMany({ where: { collectionId: { in: ids } }, data: { supersedesVersionId: null } });
    removed.receipts = await tx.familyReceiptVersion.deleteMany({ where: { collectionId: { in: ids } } }).then((row) => row.count);
    removed.shares = await tx.allocationInstrumentShare.deleteMany({ where: { allocation: { collectionId: { in: ids } } } }).then((row) => row.count);
    removed.allocations = await tx.familyStudentAllocation.deleteMany({ where: { collectionId: { in: ids } } }).then((row) => row.count);
    removed.instruments = await tx.familyCollectionInstrument.deleteMany({ where: { collectionId: { in: ids } } }).then((row) => row.count);
    await tx.familyCollection.updateMany({ where: { id: { in: ids } }, data: { replacesCollectionId: null } });
    removed.collections = await tx.familyCollection.deleteMany({ where: { id: { in: ids } } }).then((row) => row.count);
    removed.notificationEvents = await tx.notificationEvent.deleteMany({ where: { OR: [{ campaignId: { in: campaignIds } }, { recipientId: { in: recipientIds } }] } }).then((row) => row.count);
    removed.notificationRecipients = await tx.notificationRecipient.deleteMany({ where: { id: { in: recipientIds } } }).then((row) => row.count);
    removed.notificationSkippedRecipients = await tx.notificationSkippedRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } }).then((row) => row.count);
    removed.notificationCampaigns = await tx.notificationCampaign.deleteMany({ where: { id: { in: campaignIds } } }).then((row) => row.count);
    removed.cashBookDays = await tx.cashBookDay.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.links = await tx.studentGuardian.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.enrollments = await tx.academicYearEnrollment.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.students = await tx.student.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.sessions = await tx.authSession.deleteMany({ where: { userId: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.aliases = await tx.authLoginAlias.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    await tx.userRoleAssignment.updateMany({
      where: { id: { startsWith: PREFIX } },
      data: { assignedByUserId: null, endedByUserId: null }
    });
    removed.roleAssignments = await tx.userRoleAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.users = await tx.user.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
    removed.guardians = await tx.guardian.deleteMany({ where: { id: { startsWith: PREFIX } } }).then((row) => row.count);
  });
  return removed;
}

function migrate(databasePath: string) {
  const command = spawnSync("pnpm.cmd", ["exec", "prisma", "migrate", "deploy"], { cwd: path.resolve("."), env: { ...process.env, DATABASE_URL: databaseUrl(databasePath) }, encoding: "utf8", shell: true });
  if (command.status !== 0) throw new Error(`FAMPAY1_MIGRATION_FAILED: ${command.stderr || command.stdout}`);
}
function client(databasePath: string) { return new PrismaClient({ datasources: { db: { url: databaseUrl(databasePath) } } }); }
function actor() { return { id: `${PREFIX}user-accountant`, name: `${MARKER} ACCOUNTANT`, role: "ACCOUNTANT" }; }
async function expectFailure(operation: () => Promise<unknown>, fragment: string) { try { await operation(); } catch (error) { if (String(error).toLowerCase().includes(fragment.toLowerCase())) return; throw error; } throw new Error(`EXPECTED_FAILURE_NOT_RAISED: ${fragment}`); }
function assert(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(`FAMPAY1_${code}`); }
function readState(): State { if (!existsSync(STATE_PATH)) throw new Error("Run prepare first"); return JSON.parse(readFileSync(STATE_PATH, "utf8")) as State; }
function fileHash(file: string) { return createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase(); }
function assertOperationalHash(expected: string) { const actual = fileHash(OPERATIONAL_DATABASE); if (actual !== expected) throw new Error(`OPERATIONAL_DATABASE_CHANGED:${expected}:${actual}`); }

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
