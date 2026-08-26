import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { recordCafeteriaMeal } from "../../lib/cafeteria";
import { resolveDatabaseProvider } from "../../lib/database-provider";
import { assignTransportStudent } from "../../lib/transport";
import { assertSyntheticPostgresQa } from "./synthetic-qa";

const prisma = new PrismaClient();
const actor = {
  id: "postgres-readiness-restore-actor",
  role: "SUPER_ADMIN" as const,
  permissions: new Set(["MANAGE_TRANSPORT_ASSIGNMENTS", "RECORD_CAFETERIA_PARTICIPATION"])
};
const today = new Date("2026-08-26T00:00:00.000Z");

async function exactlyOne(label: string, first: () => Promise<unknown>, second: () => Promise<unknown>) {
  const results = await Promise.allSettled([first(), second()]);
  const accepted = results.filter((result) => result.status === "fulfilled").length;
  const refused = results.length - accepted;
  if (accepted !== 1 || refused !== 1) {
    const reasons = results.map((result) => result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : "accepted");
    throw new Error(`POSTGRES_CONCURRENCY_UNSAFE:${label}:${accepted}:${refused}:${reasons.join("|")}`);
  }
  return { label, accepted, refused };
}

async function countCas(label: string, attempts: Array<() => Promise<{ count: number }>>) {
  const results = await Promise.all(attempts.map((attempt) => attempt()));
  const accepted = results.reduce((sum, result) => sum + result.count, 0);
  if (accepted !== 1) throw new Error(`POSTGRES_CONCURRENCY_CAS_UNSAFE:${label}:${accepted}`);
  return { label, accepted, refused: attempts.length - accepted };
}

async function main() {
  assertSyntheticPostgresQa();
  if (resolveDatabaseProvider() !== "postgresql") throw new Error("POSTGRES_CONCURRENCY_QA_REQUIRES_POSTGRESQL");
  process.env.OPTIONAL_OPS_SYNTHETIC_QA = "1";
  process.env.TRANSPORT_V1_5 = "enabled";
  process.env.CAFETERIA_V1_5 = "enabled";
  const run = randomUUID();
  const studentIndex = 50 + (Number.parseInt(run.slice(0, 8), 16) % 700);
  const firstAdmission = `PGS${String(studentIndex).padStart(4, "0")}`;
  const secondAdmission = `PGS${String(studentIndex + 1).padStart(4, "0")}`;
  const [studentOne, studentTwo, guardian, device] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { admissionNo: firstAdmission } }),
    prisma.student.findUniqueOrThrow({ where: { admissionNo: secondAdmission } }),
    prisma.guardian.findUniqueOrThrow({ where: { id: "pg-scale-guardian-0001" } }),
    prisma.offlineSyncDevice.findUniqueOrThrow({ where: { id: "pg-scale-device" } })
  ]);
  const races: Array<{ label: string; accepted: number; refused: number }> = [];

  const payment = {
    id: `pg-race-payment-${run}`,
    date: today,
    receiptNo: `PG-RACE-${run}`,
    admissionNo: studentOne.admissionNo,
    studentId: studentOne.id,
    studentName: studentOne.studentName,
    className: studentOne.className,
    section: studentOne.section,
    amountPaid: 1250,
    paymentMode: "UPI",
    receivedAccount: "Synthetic QA",
    transactionRefNo: `PG-RACE-REF-${run}`,
    feeType: "Tuition"
  };
  races.push(await exactlyOne("fee-payment-exact-event", () => prisma.payment.create({ data: payment }), () => prisma.payment.create({ data: payment })));

  const category = await prisma.expenseCategory.upsert({
    where: { name: "PostgreSQL Concurrency QA" },
    create: { name: "PostgreSQL Concurrency QA", code: `PGCQ-${run.slice(0, 8)}` },
    update: {}
  });
  const expenseNumber = `PG-EXP-${run}`;
  const expense = (id: string) => prisma.expenseRecord.create({ data: { id, expenseNumber, expenseDate: today, academicYear: "2026-27", categoryId: category.id, description: "Synthetic duplicate-reference race", grossAmount: "100.00", netAmount: "100.00", paymentMethod: "UPI", transactionReference: `PG-EXP-REF-${run}` } });
  races.push(await exactlyOne("expense-duplicate-reference", () => expense(`pg-race-expense-a-${run}`), () => expense(`pg-race-expense-b-${run}`)));

  const receiptNumber = `PG-MISC-${run}`;
  const misc = (id: string) => prisma.miscIncomeReceipt.create({ data: { id, receiptNumber, receiptDate: today, academicYear: "2026-27", payerName: "Synthetic QA", paymentMethod: "UPI", transactionReference: `PG-MISC-REF-${run}`, grossAmount: "75.00", netAmount: "75.00" } });
  races.push(await exactlyOne("misc-income-duplicate-reference", () => misc(`pg-race-misc-a-${run}`), () => misc(`pg-race-misc-b-${run}`)));

  const collection = await prisma.familyCollection.create({ data: { publicReference: `PG-FAMILY-${run}`, payerType: "GUARDIAN", payerGuardianId: guardian.id, payerDisplayName: guardian.displayName, collectionDate: today, requestKey: `PG-FAMILY-REQUEST-${run}`, requestFingerprint: `fingerprint-${run}`, allocationPlanHash: `allocation-${run}`, totalPaise: 10000, createdByUserId: actor.id } });
  const allocation = (id: string) => prisma.familyStudentAllocation.create({ data: { id, collectionId: collection.id, studentId: studentOne.id, academicYear: "2026-27", installment: "TERM_1", feeHead: "TUITION", amountPaise: 10000, orderIndex: 1, allocationPolicy: "FAMILY_AUTO_V1", dueBeforePaise: 10000, dueAfterPaise: 0, dueSnapshotHash: `due-${run}`, studentNameSnapshot: studentOne.studentName, admissionNoSnapshot: studentOne.admissionNo, classNameSnapshot: studentOne.className, sectionSnapshot: studentOne.section } });
  races.push(await exactlyOne("family-allocation", () => allocation(`pg-race-allocation-a-${run}`), () => allocation(`pg-race-allocation-b-${run}`)));

  const activeRequestKey = `PG-PARENT-MEETING-${run}`;
  const meeting = (id: string) => prisma.parentMeeting.create({ data: { id, publicKey: randomUUID(), studentId: studentOne.id, requesterGuardianId: guardian.id, academicYear: "2026-27", source: "SYNTHETIC_QA", category: "ACADEMIC", subject: "Concurrent active request", status: "REQUESTED", activeRequestKey, createdByUserId: actor.id } });
  races.push(await exactlyOne("parent-meeting-active-request", () => meeting(`pg-race-meeting-a-${run}`), () => meeting(`pg-race-meeting-b-${run}`)));

  const mutation = (id: string, payloadHash: string) => prisma.offlineSyncMutation.create({ data: { id, deviceId: device.id, actorUserId: actor.id, activeRole: "ACCOUNTANT", clientMutationId: `pg-race-mutation-${run}`, localDraftId: `pg-race-draft-${run}`, operationType: "FEE_PAYMENT", requestHash: `request-${run}`, payloadHash, syncSchemaVersion: 1, referenceSnapshotVersion: "pg-race-reference", status: "RECEIVED", createdClientAt: today } });
  races.push(await exactlyOne("offline-sync-same-id", () => mutation(`pg-race-mutation-a-${run}`, `payload-${run}`), () => mutation(`pg-race-mutation-b-${run}`, `payload-${run}`)));

  const nativeSession = (id: string) => prisma.nativeSession.create({ data: { id, publicSessionId: randomUUID(), userId: actor.id, deviceId: device.id, roleAssignmentId: `pg-race-role-${run}`, accessTokenHash: `pg-race-access-${id}`, refreshTokenHash: `pg-race-refresh-${run}`, credentialVersion: 1, authorizationVersion: 1, scopesJson: "[]", accessExpiresAt: new Date("2026-08-26T01:00:00.000Z"), refreshExpiresAt: new Date("2026-09-26T00:00:00.000Z"), absoluteExpiresAt: new Date("2026-10-26T00:00:00.000Z") } });
  races.push(await exactlyOne("native-refresh-token-reuse", () => nativeSession(`pg-race-native-a-${run}`), () => nativeSession(`pg-race-native-b-${run}`)));

  const cycle = await prisma.admissionCycle.create({ data: { publicKey: randomUUID(), cycleCode: `PG-RACE-${run}`, name: "Synthetic concurrency admission", academicYear: "2026-27", enabledClassesJson: '["I"]', admissionNumberPrefix: "PG", createdByUserId: actor.id } });
  const application = await prisma.admissionApplication.create({ data: { publicKey: randomUUID(), applicationNumber: `PG-APP-${run}`, cycleId: cycle.id, status: "APPLICATION_INVITED", retentionReviewAt: new Date("2027-08-26T00:00:00.000Z"), createdByUserId: actor.id } });
  const conversion = (id: string) => prisma.admissionConversion.create({ data: { id, publicKey: randomUUID(), applicationId: application.id, requestKey: `PG-CONVERT-${run}`, studentId: `pg-converted-student-${run}`, enrollmentId: `pg-converted-enrollment-${run}`, admissionNumber: `PG-CONVERTED-${run}`, guardianIdsJson: "[]", guardianLinkIdsJson: "[]", actorUserId: actor.id, convertedAt: today, lineageHash: `lineage-${run}` } });
  races.push(await exactlyOne("admission-exactly-once", () => conversion(`pg-race-conversion-a-${run}`), () => conversion(`pg-race-conversion-b-${run}`)));

  const attendance = await prisma.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-25T00:00:00.000Z"), className: `PG-${run}`, section: "A", academicYear: "2026-27", status: "DRAFT", takenByUserId: actor.id } });
  races.push(await countCas("attendance-submit-lock-claim", [
    () => prisma.studentAttendanceSession.updateMany({ where: { id: attendance.id, status: "DRAFT" }, data: { status: "SUBMITTED", submittedByUserId: actor.id, submittedAt: today } }),
    () => prisma.studentAttendanceSession.updateMany({ where: { id: attendance.id, status: "DRAFT" }, data: { status: "SUBMITTED", submittedByUserId: actor.id, submittedAt: today } })
  ]));

  const album = await prisma.eventMediaAlbum.create({ data: { publicKey: randomUUID(), title: "Synthetic PostgreSQL race", eventDate: today, createdByUserId: actor.id } });
  races.push(await countCas("event-media-publication-version-claim", [
    () => prisma.eventMediaAlbum.updateMany({ where: { id: album.id, rowVersion: 1 }, data: { title: "Synthetic PostgreSQL race A", rowVersion: { increment: 1 } } }),
    () => prisma.eventMediaAlbum.updateMany({ where: { id: album.id, rowVersion: 1 }, data: { title: "Synthetic PostgreSQL race B", rowVersion: { increment: 1 } } })
  ]));

  const vehicle = await prisma.transportVehicle.create({ data: { publicKey: randomUUID(), registrationCode: `PG-${run}`, displayName: "Synthetic one-seat vehicle", capacity: 1 } });
  const route = await prisma.transportRoute.create({ data: { publicKey: randomUUID(), code: `PG-ROUTE-${run}`, name: "Synthetic one-seat route", vehicleId: vehicle.id, capacity: 1 } });
  const pickupStop = await prisma.transportStop.create({ data: { publicKey: randomUUID(), code: `PG-PICKUP-${run}`, name: "Synthetic pickup" } });
  const dropStop = await prisma.transportStop.create({ data: { publicKey: randomUUID(), code: `PG-DROP-${run}`, name: "Synthetic drop" } });
  const pickup = await prisma.transportRouteStop.create({ data: { publicKey: randomUUID(), routeId: route.id, stopId: pickupStop.id, direction: "MORNING", sequence: 1 } });
  const drop = await prisma.transportRouteStop.create({ data: { publicKey: randomUUID(), routeId: route.id, stopId: dropStop.id, direction: "EVENING", sequence: 1 } });
  const assignment = (admissionNo: string) => assignTransportStudent(prisma, actor, { admissionNo, routeKey: route.publicKey, pickupRouteStopKey: pickup.publicKey, dropRouteStopKey: drop.publicKey, effectiveFrom: "2026-08-26", changeReason: "Synthetic concurrency capacity proof" });
  races.push(await exactlyOne("transport-last-seat", () => assignment(studentOne.admissionNo), () => assignment(studentTwo.admissionNo)));

  const catalog = await prisma.cafeteriaCatalogItem.create({ data: { publicKey: randomUUID(), code: `PG-FOOD-${run}`, name: "Synthetic meal", category: "QA" } });
  const menuDate = new Date(today.getTime() + (Number.parseInt(run.slice(0, 8), 16) % 86_400_000));
  const menu = await prisma.cafeteriaMenu.create({ data: { publicKey: randomUUID(), menuDate, dayLabel: "Synthetic QA", mealPlanName: "STANDARD" } });
  const menuItem = await prisma.cafeteriaMenuItem.create({ data: { publicKey: randomUUID(), menuId: menu.id, itemId: catalog.id, mealSlot: "LUNCH" } });
  await prisma.cafeteriaStudentEnrollment.create({ data: { publicKey: randomUUID(), studentId: studentTwo.id, activeStudentId: studentTwo.id, mealPlanName: "STANDARD", effectiveFrom: new Date("2026-08-01T00:00:00.000Z"), active: true, changeReason: "SYNTHETIC_QA", createdByUserId: actor.id, createdByRole: actor.role } });
  const meal = () => recordCafeteriaMeal(prisma, actor, { admissionNo: studentTwo.admissionNo, menuItemKey: menuItem.publicKey, serviceDate: "2026-08-26", mealSlot: "LUNCH", recordType: "PARTICIPATION", idempotencyKey: `pg-meal-${run}` });
  races.push(await exactlyOne("cafeteria-duplicate-meal", meal, meal));

  const job = (id: string) => prisma.backgroundJobRun.create({ data: { id, publicKey: randomUUID(), idempotencyKey: `pg-reminder-${run}`, jobType: "REMINDER", component: "POSTGRES_READINESS_QA", summarySafe: "Synthetic deduplication proof", expiresAt: new Date("2026-08-27T00:00:00.000Z") } });
  races.push(await exactlyOne("background-reminder-deduplication", () => job(`pg-race-job-a-${run}`), () => job(`pg-race-job-b-${run}`)));

  const batch = (id: string) => prisma.importBatch.create({ data: { id, type: "STUDENT", fileName: "synthetic.csv", importedByUserId: actor.id, importedByName: "Synthetic PostgreSQL QA", mode: "DRY_RUN", totalRows: 1, status: "VALIDATED" } });
  races.push(await exactlyOne("bulk-import-batch-idempotency", () => batch(`pg-race-import-${run}`), () => batch(`pg-race-import-${run}`)));

  const evidence = {
    result: "POSTGRES_CONCURRENCY_CONTRACT_PASSED",
    databaseRaces: races,
    databaseRaceCount: races.length,
    safeOutcomeCount: races.filter((race) => race.accepted === 1 && race.refused === 1).length,
    isolation: {
      default: ["unique-key and idempotency claims"],
      serializableWithBoundedRetry: ["multi-record financial posting when a service owns a safely retryable transaction"],
      compareAndSwap: ["attendance state", "event media row version"],
      lockOrder: ["parent then immutable child/event rows", "route capacity claim before assignment insert", "authoritative sync mutation before financial record"]
    },
    providerAgnosticRegression: ["marks authorization", "report replacement/publication", "same business payment from two devices", "device revocation during sync", "last Super Admin protection", "native refresh rotation", "Offline Sync conflict/rejection"]
  };
  const output = path.resolve(process.env.POSTGRES_CONCURRENCY_EVIDENCE ?? "tmp/postgres-readiness-1a/concurrency.json");
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ result: evidence.result, databaseRaceCount: races.length, safeOutcomeCount: evidence.safeOutcomeCount }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
