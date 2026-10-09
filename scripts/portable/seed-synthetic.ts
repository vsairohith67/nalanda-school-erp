import { initializeSyntheticFoundation } from "./synthetic-foundation";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertPortableRuntimeConfiguration } from "@/lib/portable-runtime/config";
import { hashPassword } from "@/lib/password";
import { ensureDefaultRolePermissions } from "@/lib/role-permissions";
import { readPortableSecret } from "@/lib/portable-runtime/secrets";

const prisma = new PrismaClient();
const generatedAt = new Date("2026-08-26T00:00:00.000Z");
const markerId = "portable-synthetic-marker";
const actorId = "portable-synthetic-director";
const offlinePublicSigningKey = JSON.stringify({
  kty: "EC",
  crv: "P-256",
  x: "9gFDiAFy0ASC1vDHn6_z0xzmBtngeG7BWYs7p57PmIM",
  y: "-IOVyc8QquzAdi0d34l2_jfW0dYDNhzUgvlYmQN_4Wk",
  ext: true,
  key_ops: ["verify"]
});
const offlinePublicKeyHash = "befd58decea4eadc6ad5e283bc7aaf96315f10299164346cfa261dc8bd0c4ea5";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function createInBatches<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += 200) await create(rows.slice(offset, offset + 200));
}

async function createMany(delegate: any, rows: unknown[]) {
  await createInBatches(rows, (data) => delegate.createMany({ data, skipDuplicates: true }));
}

function assertSyntheticTarget(configuration: ReturnType<typeof assertPortableRuntimeConfiguration>) {
  if (configuration.environment !== "synthetic-staging" || process.env.NALANDA_SYNTHETIC_STAGING !== "true" || process.env.STAGING_SYNTHETIC_SEED_OPT_IN !== "true") {
    throw new Error("PORTABLE_SYNTHETIC_SEED_OPT_IN_REQUIRED");
  }
  const target = new URL(configuration.databaseUrl);
  if (!/(?:^|_)synthetic(?:_|$)/i.test(target.pathname) || !new Set(["postgres", "localhost", "127.0.0.1", "::1"]).has(target.hostname)) {
    throw new Error("PORTABLE_SYNTHETIC_DATABASE_TARGET_REFUSED");
  }
}

async function assertEmptyOrMarked() {
  const marker = await prisma.schoolSettings.findUnique({ where: { id: markerId }, select: { id: true } });
  if (marker) return;
  const [students, users, payments, settings] = await Promise.all([
    prisma.student.count(), prisma.user.count(), prisma.payment.count(), prisma.schoolSettings.count()
  ]);
  if (students || users || payments || settings) throw new Error("PORTABLE_SYNTHETIC_DATABASE_NOT_EMPTY_OR_MARKED");
}

async function seed() {
  const configuration = assertPortableRuntimeConfiguration(process.env, "seed-synthetic");
  assertSyntheticTarget(configuration);
  await assertEmptyOrMarked();
  await initializeSyntheticFoundation(prisma);

  const students = Array.from({ length: 800 }, (_, index) => ({
    id: `portable-student-${String(index).padStart(4, "0")}`,
    academicYear: "2026-27",
    admissionNo: `SYN${String(index).padStart(5, "0")}`,
    studentName: `Synthetic Student ${String(index).padStart(4, "0")}`,
    fatherName: `Synthetic Guardian ${String(index).padStart(4, "0")}`,
    className: String((index % 10) + 1),
    section: ["A", "B", "C", "D"][index % 4],
    phone1: `0000${String(index).padStart(6, "0")}`,
    status: "Active",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  const guardians = Array.from({ length: 1_200 }, (_, index) => ({
    id: `portable-guardian-${String(index).padStart(4, "0")}`,
    displayName: `Synthetic Guardian ${String(index).padStart(4, "0")}`,
    primaryMobile: `0001${String(index).padStart(6, "0")}`,
    relationship: "Parent",
    status: "Active",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  const staff = Array.from({ length: 80 }, (_, index) => ({
    id: `portable-staff-${String(index).padStart(3, "0")}`,
    staffCode: `SYNST${String(index).padStart(3, "0")}`,
    fullName: `Synthetic Staff ${String(index).padStart(3, "0")}`,
    staffType: index < 45 ? "TEACHING" : "NON_TEACHING",
    designation: index < 45 ? "Teacher" : "Operations",
    status: "ACTIVE",
    createdAt: generatedAt,
    updatedAt: generatedAt
  }));
  await createMany(prisma.student, students);
  await createMany(prisma.guardian, guardians);
  await createMany(prisma.staffMember, staff);
  await createMany(prisma.studentGuardian, students.map((student, index) => ({
    id: `portable-student-guardian-${String(index).padStart(4, "0")}`,
    guardianId: guardians[index].id,
    studentId: student.id,
    relationshipToStudent: "Parent",
    isPrimaryContact: true,
    createdAt: generatedAt,
    updatedAt: generatedAt
  })));

  const payments = Array.from({ length: 2_400 }, (_, index) => {
    const student = students[index % students.length];
    return {
      id: `portable-payment-${String(index).padStart(5, "0")}`,
      date: new Date(generatedAt.getTime() + index * 1_000),
      receiptNo: `SYNR${String(index).padStart(6, "0")}`,
      admissionNo: student.admissionNo,
      studentId: student.id,
      studentName: student.studentName,
      className: student.className,
      section: student.section,
      amountPaid: 1_000 + (index % 500),
      paymentMode: index % 2 ? "UPI" : "Cash",
      receivedAccount: index % 2 ? "NPS Current Account UPI" : "Cash",
      feeType: "Current Year Fee",
      enteredBy: "Portable Synthetic Seed",
      createdAt: generatedAt,
      updatedAt: generatedAt
    };
  });
  await createMany(prisma.payment, payments);
  await createMany(prisma.parentMeeting, Array.from({ length: 1_000 }, (_, index) => ({
    id: `portable-meeting-${String(index).padStart(4, "0")}`,
    publicKey: `portable-meeting-public-${String(index).padStart(4, "0")}`,
    studentId: students[index % students.length].id,
    requesterGuardianId: guardians[index % 800].id,
    academicYear: "2026-27",
    source: "LEADERSHIP_CREATED",
    category: "ACADEMIC_PROGRESS",
    subject: `Synthetic meeting ${String(index).padStart(4, "0")}`,
    status: "REQUESTED",
    createdByUserId: actorId,
    createdAt: generatedAt,
    updatedAt: generatedAt
  })));

  const device = await prisma.offlineSyncDevice.upsert({
    where: { publicDeviceId: "portable-synthetic-device-public" },
    update: { label: "Portable Synthetic Device" },
    create: { id: "portable-synthetic-device", publicDeviceId: "portable-synthetic-device-public", userId: actorId, label: "Portable Synthetic Device", platform: "DESKTOP", publicSigningKey: offlinePublicSigningKey, publicKeyHash: offlinePublicKeyHash, status: "ACTIVE", approvedAt: generatedAt, approvedByUserId: actorId }
  });
  await createMany(prisma.offlineSyncMutation, Array.from({ length: 2_000 }, (_, index) => ({
    id: `portable-mutation-${String(index).padStart(5, "0")}`,
    deviceId: device.id,
    actorUserId: actorId,
    activeRole: "DIRECTOR",
    clientMutationId: `portable-client-mutation-${String(index).padStart(5, "0")}`,
    localDraftId: `portable-draft-${String(index).padStart(5, "0")}`,
    operationType: "FEE_PAYMENT",
    requestHash: sha256(`portable-request-${String(index).padStart(5, "0")}`),
    payloadHash: sha256(`portable-payload-${String(index).padStart(5, "0")}`),
    syncSchemaVersion: 1,
    referenceSnapshotVersion: sha256("portable-synthetic-reference-v1"),
    status: "RECEIVED",
    createdClientAt: generatedAt,
    receivedServerAt: generatedAt,
    lastAttemptAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt
  })));
  await createMany(prisma.nativeSession, Array.from({ length: 1_000 }, (_, index) => ({
    id: `portable-native-session-${String(index).padStart(4, "0")}`,
    publicSessionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    userId: actorId,
    deviceId: device.id,
    roleAssignmentId: `portable-role-${String(index).padStart(4, "0")}`,
    accessTokenHash: sha256(`portable-access-${String(index).padStart(4, "0")}`),
    refreshTokenHash: sha256(`portable-refresh-${String(index).padStart(4, "0")}`),
    credentialVersion: 1,
    authorizationVersion: 1,
    scopesJson: JSON.stringify(["offline:context", "offline:reference", "offline:sync", "offline:own-conflicts"]),
    accessExpiresAt: new Date("2026-08-26T01:00:00.000Z"),
    refreshExpiresAt: new Date("2026-09-26T00:00:00.000Z"),
    absoluteExpiresAt: new Date("2026-10-26T00:00:00.000Z"),
    lastSeenAt: generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt
  })));

  const counts = {
    students: await prisma.student.count({ where: { id: { startsWith: "portable-student-" } } }),
    guardians: await prisma.guardian.count({ where: { id: { startsWith: "portable-guardian-" } } }),
    staff: await prisma.staffMember.count({ where: { id: { startsWith: "portable-staff-" } } }),
    payments: await prisma.payment.count({ where: { id: { startsWith: "portable-payment-" } } }),
    parentMeetings: await prisma.parentMeeting.count({ where: { id: { startsWith: "portable-meeting-" } } }),
    offlineMutations: await prisma.offlineSyncMutation.count({ where: { id: { startsWith: "portable-mutation-" } } }),
    nativeSessions: await prisma.nativeSession.count({ where: { id: { startsWith: "portable-native-session-" } } })
  };
  if (counts.students !== 800 || counts.guardians !== 1_200 || counts.staff !== 80 || counts.payments !== 2_400 || counts.parentMeetings !== 1_000 || counts.offlineMutations !== 2_000 || counts.nativeSessions !== 1_000) {
    throw new Error("PORTABLE_SYNTHETIC_SEED_COUNT_MISMATCH");
  }
  console.log(JSON.stringify({ result: "PORTABLE_SYNTHETIC_SEED_PASSED", counts, realData: false }));
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : "PORTABLE_SYNTHETIC_SEED_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
