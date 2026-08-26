import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseProvider } from "../../lib/database-provider";
import { hashPassword } from "../../lib/password";
import { assertSyntheticPostgresQa } from "./synthetic-qa";

const prisma = new PrismaClient();
const generatedAt = new Date("2026-08-26T00:00:00.000Z");

async function createInBatches<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += 250) await create(rows.slice(offset, offset + 250));
}

async function seedScale() {
  const disabledPasswordHash = await hashPassword(randomBytes(48).toString("base64url"));
  await prisma.user.upsert({
    where: { id: "postgres-readiness-restore-actor" },
    create: { id: "postgres-readiness-restore-actor", name: "PostgreSQL Readiness Restore Actor", username: "postgres-readiness-restore-actor", email: "postgres-readiness-restore@invalid.local", role: "DIRECTOR", isActive: false, mustChangePassword: true, passwordHash: disabledPasswordHash },
    update: { isActive: false, mustChangePassword: true, passwordHash: disabledPasswordHash }
  });
  const students = Array.from({ length: 800 }, (_, index) => ({
    id: `pg-scale-student-${String(index).padStart(4, "0")}`,
    academicYear: "2026-27",
    admissionNo: `PGS${String(index).padStart(4, "0")}`,
    studentName: `Scale Student ${String(index).padStart(4, "0")}`,
    fatherName: `Scale Guardian ${String(index).padStart(4, "0")}`,
    className: String((index % 10) + 1),
    section: ["A", "B", "C", "D"][index % 4],
    phone1: `9000${String(index).padStart(6, "0")}`,
    status: "Active",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  const guardians = Array.from({ length: 1200 }, (_, index) => ({
    id: `pg-scale-guardian-${String(index).padStart(4, "0")}`,
    displayName: `Scale Guardian ${String(index).padStart(4, "0")}`,
    primaryMobile: `9100${String(index).padStart(6, "0")}`,
    relationship: "Parent",
    status: "Active",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  const staff = Array.from({ length: 80 }, (_, index) => ({
    id: `pg-scale-staff-${String(index).padStart(3, "0")}`,
    staffCode: `PGST${String(index).padStart(3, "0")}`,
    fullName: `Scale Staff ${String(index).padStart(3, "0")}`,
    staffType: index < 45 ? "TEACHING" : "NON_TEACHING",
    designation: index < 45 ? "Teacher" : "Operations",
    status: "ACTIVE",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  await createInBatches(students, (data) => prisma.student.createMany({ data, skipDuplicates: true }));
  await createInBatches(guardians, (data) => prisma.guardian.createMany({ data, skipDuplicates: true }));
  await createInBatches(staff, (data) => prisma.staffMember.createMany({ data, skipDuplicates: true }));
  await createInBatches(
    students.map((student, index) => ({ id: `pg-scale-link-${String(index).padStart(4, "0")}`, guardianId: guardians[index].id, studentId: student.id, relationshipToStudent: "Parent", isPrimaryContact: true, createdAt: generatedAt, updatedAt: generatedAt })),
    (data) => prisma.studentGuardian.createMany({ data, skipDuplicates: true })
  );

  const payments = Array.from({ length: 2400 }, (_, index) => {
    const student = students[index % students.length];
    return {
      id: `pg-scale-payment-${String(index).padStart(5, "0")}`,
      date: new Date(generatedAt.getTime() + index * 1000),
      receiptNo: `PGR${String(index).padStart(6, "0")}`,
      admissionNo: student.admissionNo,
      studentId: student.id,
      studentName: student.studentName,
      className: student.className,
      section: student.section,
      amountPaid: 1000 + (index % 500),
      paymentMode: index % 2 ? "UPI" : "Cash",
      receivedAccount: "Synthetic QA",
      feeType: "Tuition",
      createdAt: generatedAt,
      updatedAt: generatedAt
    };
  });
  await createInBatches(payments, (data) => prisma.payment.createMany({ data, skipDuplicates: true }));

  const meetings = Array.from({ length: 1000 }, (_, index) => ({
    id: `pg-scale-meeting-${String(index).padStart(4, "0")}`,
    publicKey: `pg-scale-meeting-public-${String(index).padStart(4, "0")}`,
    studentId: students[index % students.length].id,
    requesterGuardianId: guardians[index % 800].id,
    academicYear: "2026-27",
    source: "SYNTHETIC_QA",
    category: "ACADEMIC",
    subject: `Scale meeting ${String(index).padStart(4, "0")}`,
    status: "REQUESTED",
    createdByUserId: "postgres-readiness-restore-actor",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  await createInBatches(meetings, (data) => prisma.parentMeeting.createMany({ data, skipDuplicates: true }));

  const device = await prisma.offlineSyncDevice.upsert({
    where: { publicDeviceId: "pg-scale-device-public" },
    create: { id: "pg-scale-device", publicDeviceId: "pg-scale-device-public", userId: "postgres-readiness-restore-actor", label: "Synthetic Scale Device", platform: "DESKTOP", publicSigningKey: "synthetic-public-key", publicKeyHash: "pg-scale-device-key-hash", status: "ACTIVE", approvedAt: generatedAt, approvedByUserId: "postgres-readiness-restore-actor" },
    update: { label: "Synthetic Scale Device" }
  });
  const mutations = Array.from({ length: 2000 }, (_, index) => ({
    id: `pg-scale-mutation-${String(index).padStart(5, "0")}`,
    deviceId: device.id,
    actorUserId: "postgres-readiness-restore-actor",
    activeRole: "DIRECTOR",
    clientMutationId: `pg-scale-client-mutation-${String(index).padStart(5, "0")}`,
    localDraftId: `pg-scale-draft-${String(index).padStart(5, "0")}`,
    operationType: "FEE_PAYMENT",
    requestHash: `request-${String(index).padStart(5, "0")}`,
    payloadHash: `payload-${String(index).padStart(5, "0")}`,
    syncSchemaVersion: 1,
    referenceSnapshotVersion: "pg-scale-reference",
    status: "RECEIVED",
    createdClientAt: generatedAt,
    receivedServerAt: generatedAt,
    lastAttemptAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  await createInBatches(mutations, (data) => prisma.offlineSyncMutation.createMany({ data, skipDuplicates: true }));

  const nativeSessions = Array.from({ length: 1000 }, (_, index) => ({
    id: `pg-scale-native-session-${String(index).padStart(4, "0")}`,
    publicSessionId: `pg-scale-native-public-${String(index).padStart(4, "0")}`,
    userId: "postgres-readiness-restore-actor",
    deviceId: device.id,
    roleAssignmentId: `pg-scale-role-${String(index).padStart(4, "0")}`,
    accessTokenHash: `pg-scale-access-${String(index).padStart(4, "0")}`,
    refreshTokenHash: `pg-scale-refresh-${String(index).padStart(4, "0")}`,
    credentialVersion: 1,
    authorizationVersion: 1,
    scopesJson: "[]",
    accessExpiresAt: new Date("2026-08-26T01:00:00.000Z"),
    refreshExpiresAt: new Date("2026-09-26T00:00:00.000Z"),
    absoluteExpiresAt: new Date("2026-10-26T00:00:00.000Z"),
    lastSeenAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  await createInBatches(nativeSessions, (data) => prisma.nativeSession.createMany({ data, skipDuplicates: true }));
}

const plans = [
  ["login-alias", `SELECT "userId" FROM "AuthLoginAlias" WHERE "normalizedValue" = 'synthetic-unmatched' LIMIT 1`],
  ["web-session", `SELECT "userId" FROM "AuthSession" WHERE "tokenHash" = 'synthetic-unmatched' LIMIT 1`],
  ["student-lookup", `SELECT "id" FROM "Student" WHERE "admissionNo" = 'PGS0400' LIMIT 1`],
  ["fee-payment-history", `SELECT "id", "amountPaid" FROM "Payment" WHERE "admissionNo" = 'PGS0400' ORDER BY "date" DESC LIMIT 50`],
  ["attendance", `SELECT "id" FROM "StudentAttendanceRecord" WHERE "studentId" = 'pg-scale-student-0400' LIMIT 50`],
  ["marks-report", `SELECT "id" FROM "ExamMarkEntry" WHERE "studentId" = 'pg-scale-student-0400' LIMIT 50`],
  ["parent-linked-child", `SELECT "studentId" FROM "StudentGuardian" WHERE "guardianId" = 'pg-scale-guardian-0400' LIMIT 25`],
  ["search-student", `SELECT "id", "studentName" FROM "Student" WHERE "studentName" LIKE 'Scale Student 04%' ORDER BY "studentName" LIMIT 25`],
  ["offline-mutation", `SELECT "status" FROM "OfflineSyncMutation" WHERE "deviceId" = 'pg-scale-device' AND "clientMutationId" = 'pg-scale-client-mutation-01000' LIMIT 1`],
  ["native-refresh", `SELECT "id" FROM "NativeSession" WHERE "refreshTokenHash" = 'pg-scale-refresh-0400' LIMIT 1`],
  ["parent-meeting-queue", `SELECT "id" FROM "ParentMeeting" WHERE "status" = 'REQUESTED' ORDER BY "scheduledStartAt" NULLS LAST LIMIT 50`],
  ["transport-roster", `SELECT "id" FROM "TransportStudentAssignment" WHERE "studentId" = 'pg-scale-student-0400' ORDER BY "effectiveFrom" DESC LIMIT 10`],
  ["cafeteria-enrollment", `SELECT "id" FROM "CafeteriaStudentEnrollment" WHERE "studentId" = 'pg-scale-student-0400' ORDER BY "effectiveFrom" DESC LIMIT 10`]
] as const;

async function main() {
  assertSyntheticPostgresQa();
  if (resolveDatabaseProvider() !== "postgresql") throw new Error("POSTGRES_PERFORMANCE_QA_REQUIRES_POSTGRESQL");
  await seedScale();
  await prisma.$executeRawUnsafe(`ANALYZE`);
  const queryPlans = [];
  for (const [name, query] of plans) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
    const document = rows[0]?.["QUERY PLAN"] as Array<Record<string, unknown>> | undefined;
    const executionMs = Number(document?.[0]?.["Execution Time"] ?? Number.POSITIVE_INFINITY);
    queryPlans.push({ name, executionMs, plan: document?.[0]?.Plan ?? null });
  }
  const scale = {
    students: await prisma.student.count({ where: { id: { startsWith: "pg-scale-student-" } } }),
    guardians: await prisma.guardian.count({ where: { id: { startsWith: "pg-scale-guardian-" } } }),
    staff: await prisma.staffMember.count({ where: { id: { startsWith: "pg-scale-staff-" } } }),
    teachers: await prisma.staffMember.count({ where: { id: { startsWith: "pg-scale-staff-" }, staffType: "TEACHING" } }),
    payments: await prisma.payment.count({ where: { id: { startsWith: "pg-scale-payment-" } } }),
    parentMeetings: await prisma.parentMeeting.count({ where: { id: { startsWith: "pg-scale-meeting-" } } }),
    offlineMutations: await prisma.offlineSyncMutation.count({ where: { id: { startsWith: "pg-scale-mutation-" } } }),
    nativeSessions: await prisma.nativeSession.count({ where: { id: { startsWith: "pg-scale-native-session-" } } })
  };
  const maxExecutionMs = Math.max(...queryPlans.map((plan) => plan.executionMs));
  if (scale.students < 800 || scale.guardians < 1200 || scale.staff < 80 || scale.teachers < 45 || scale.parentMeetings < 1000 || maxExecutionMs > 2000) {
    throw new Error(`POSTGRES_PERFORMANCE_CONTRACT_FAILED:${JSON.stringify({ scale, maxExecutionMs })}`);
  }
  const evidence = { result: "POSTGRES_PERFORMANCE_CONTRACT_PASSED", scale, queryCount: queryPlans.length, maxExecutionMs, queryPlans };
  const output = path.resolve(process.env.POSTGRES_PERFORMANCE_EVIDENCE ?? "tmp/postgres-readiness-1a/performance.json");
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ result: evidence.result, scale, queryCount: queryPlans.length, maxExecutionMs }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
